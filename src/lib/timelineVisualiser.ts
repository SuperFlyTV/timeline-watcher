import { fabric } from 'fabric'

import { Resolver, ResolvedTimeline, TimelineResolvedObject, TriggerType, UnresolvedTimeline } from 'superfly-timeline'

export class TimelineVisualizer {
	 /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
	private readonly layerLabelWidthProportionOfCanvas = 0.25

	// List of layers to display.
	private layers: Array<string> = ['mainLayer', 'graphicsLayer', 'DSK', 'PSALayer']
	// Width of column of layer labels.
	private layerLabelWidth: number

	// Canvas to draw to.
	private canvas: fabric.Canvas

	// Width and height of the canvas, in pixels.
	private canvasWidth: number
	private canvasHeight: number

	// Height of a timeline row, in pixels.
	private rowHeight: number

	// Store the last timeline drawn, for redrawing and comparisons.
	private lastTimelineDrawn: ResolvedTimeline

	// List of all objects displayed on the timeline.
	private timeLineObjects: {[layer: string]: Array<fabric.Object>} = {}

	// Width of the actual timeline within the canvas, in pixels.
	private timelineWidth: number
	// Start and end of the timeline relative to the left of the canvas, in pixels.
	private timelineStart: number

	// Start and end time of the current view. Defines the objects within view on the timeline.
	private drawTimeStart: number
	private drawTimeEnd: number

	// Scaled timeline start and end, according to zoom.
	private scaledDrawTimeStart: number
	private scaledDrawTimeEnd: number

	// Width of an object per unit time of duration.
	private pixelsWidthPerUnitTime: number

	// Store whether the mouse is held down, for scrolling.
	private mouseDown: boolean

	// Last x positions of the mouse cursor (on click and on drag), for scrolling.
	private mouseLastClickX: number
	private mouseLastX: number

	// Last direction the user moved on the timeline, helps to smooth changing scroll direction.
	private lastScrollDirection: number

	// Current zoom amount.
	private timelineZoom: number

	/**
	 * @param {string} canvasId The ID of the canvas object to draw within.
	 */
	constructor (canvasId: string) {
		// Initialise map of canvas objects.
		this.timeLineObjects['background'] = []
		this.timeLineObjects['layerLabels'] = []
		this.timeLineObjects['timeEvents'] = []
		this.timeLineObjects['logicalEvents'] = []

		// Initialise other values.
		this.mouseDown = false
		this.timelineZoom = 100

		// Create new canvas object.
		this.canvas = new fabric.Canvas(canvasId)

		// Disable group selection.
		this.canvas.selection = false
		// Set cursor.
		this.canvas.hoverCursor = 'default'

		// Register canvas interaction event handlers.
		this.canvas.on('mouse:down', event => this.canvasMouseDown(event))
		this.canvas.on('mouse:up', event => this.canvasMouseUp(event))
		this.canvas.on('mouse:move', event => this.canvasMouseMove(event))
		this.canvas.on('mouse:wheel', event => this.canvasScrollWheel(event))

		// Get width and height of canvas.
		this.canvasWidth = this.canvas.getWidth()
		this.canvasHeight = this.canvas.getHeight()

		// Calculate width of label column.
		this.layerLabelWidth = this.canvasWidth * this.layerLabelWidthProportionOfCanvas

		// Calculate timeline width and start point.
		this.timelineWidth = this.canvasWidth - this.layerLabelWidth
		this.timelineStart = this.layerLabelWidth

		// Draw background.
		let background = new fabric.Rect({
			left: 0,
			top: 0,
			fill: 'grey',
			width: this.canvasWidth,
			height: this.canvasHeight,
			selectable: false
		})
		this.canvas.add(background)
		this.timeLineObjects['background'].push(background)
	}

	/**
	 * Sets the timeline to draw.
	 * @param {UnresolvedTimeline} timeline Timeline to draw.
	 */
	setTimeline (timeline: UnresolvedTimeline) {
		// Resolve timeline.
		let resolvedTimeline = Resolver.getTimelineInWindow(timeline)

		// Calculate height of rows based on number of layers.
		// In future layers will be pulled from the timeline.
		this.rowHeight = this.calculateRowHeight(this.layers)

		// Draw the layer labels.
		this.drawLayerLabels()

		// If the timeline contains any objects, draw.
		if (resolvedTimeline.resolved.length > 0) {
			this.drawInitialTimeline(resolvedTimeline)

			// Store last timeline drawn.
			this.lastTimelineDrawn = resolvedTimeline
		}
	}

	/**
	 * Gets the layers used by a timeline.
	 * @param timeline Timeline being displayed.
	 * @returns {<Array<string>} Array of layer names.
	 */
	getLayersFromTimeline (timeline: ResolvedTimeline): Array<string> {
		let layers: Array<string> = []

		// Iterate through all resolved objects, add any new layers to the list.
		timeline.resolved.forEach(element => {
			if (layers.indexOf(element.LLayer.toString()) === -1) {
				layers.push(element.LLayer.toString())
			}
		})

		return layers
	}

	/**
	 * Calculates the height to give to each row to fit all layers on screen.
	 * @param {Array<string>} layers List of layers to use.
	 * @returns Number of layers.
	 */
	calculateRowHeight (layers: Array<string>): number {
		return this.canvasHeight / layers.length
	}

	/**
	 * Draws the layer labels to the canvas.
	 */
	drawLayerLabels () {
		// Iterate through layers.
		for (let _i = 0; _i < this.layers.length; _i++) {
			// Create a background rectangle.
			let layerRect = new fabric.Rect({
				left: 0,
				top: _i * this.rowHeight,
				fill: 'black',
				width: this.layerLabelWidth,
				height: this.rowHeight,
				selectable: false,
			})

			// Create label.
			let layerText = new fabric.Text(this.layers[_i], {
				width: this.layerLabelWidth,
				fontFamily: 'Calibri',
				fontSize: 16,
				textAlign: 'right',
				fill: 'white',
				selectable: false,
				top: (_i * this.rowHeight) + (this.rowHeight / 2)
			})

			// If this is the topmost label, draw to screen.
			// Otherwise, add a line between rows.
			if (_i === 0) {
				// Group background and label.
				let layerGroup = new fabric.Group([layerRect, layerText], {
					selectable: false
				})

				// Draw.
				this.canvas.add(layerGroup)
				this.timeLineObjects['layerLabels'].push(layerGroup)
			} else {
				// Create line.
				let layerLine = new fabric.Rect({
					left: this.layerLabelWidth,
					top: _i * this.rowHeight,
					fill: 'black',
					width: this.timelineWidth,
					height: 1,
					selectable: false
				})

				// Group background, label, and line.
				let layerGroup = new fabric.Group([layerRect, layerText, layerLine], {
					selectable: false
				})

				// Draw.
				this.canvas.add(layerGroup)
				this.timeLineObjects['layerLabels'].push(layerGroup)
			}
		}
	}

	/**
	 * Draws the timeline initially.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 */
	drawInitialTimeline (timeline: ResolvedTimeline) {
		// Find the min and max start times, so that the view starts with
		// all of the timeline in view
		this.drawTimeStart = this.findMinStartTime(timeline)
		this.drawTimeEnd = this.findMaxEndTime(timeline)

		// Calculate new zoom values.
		this.updateZoomValues()

		this.drawTimeline(timeline)
	}

	/**
	 * Redraws the timeline to the canvas.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 */
	redrawTimeline (timeline: ResolvedTimeline) {
		// Remove previous timeline objects from the canvas.
		this.timeLineObjects['timeEvents'].forEach(element => {
			this.canvas.remove(element)
		})

		// Draw timeline.
		this.drawTimeline(timeline)
	}

	/**
	 * Draws a timeline to the canvas.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 */
	drawTimeline (timeline: ResolvedTimeline) {
		// Don't draw an empty timeline.
		if (timeline.resolved.length === 0) {
			return
		}

		// Calculate how many pixels are required per unit time.
		this.pixelsWidthPerUnitTime = this.timelineWidth / (this.scaledDrawTimeEnd - this.scaledDrawTimeStart)

		// Iterate through TimelineResolvedObject in timeline.
		timeline.resolved.forEach(resolvedObject => {
			if (this.showObjectOnTimeline(resolvedObject)) {
				// Calculate object offset from timeline start.
				let offsetFromStart = this.getResolvedObjectOffsetFromTimelineStart(resolvedObject)
				// Calculate width of object.
				let objectWidth = this.getResolvedObjectEndPointFromTimelineStart(resolvedObject)

				// If the offset is less than 0, subtract from the width and set to 0.
				if (offsetFromStart < 0) {
					objectWidth += offsetFromStart
					offsetFromStart = 0
				}

				// Create a rectangle representing object duration.
				let resolvedObjectRect = new fabric.Rect({
					left: this.timelineStart + offsetFromStart,
					width: objectWidth,
					height: this.rowHeight * (2 / 3),
					top: this.getResolvedObjectTop(resolvedObject),
					fill: 'rgba(105, 35, 140, 0.5)',
					stroke: 'rgba(53, 17, 71, 0.5)',
					strokeWidth: 1,
					selectable: false
				})

				// Add a label to the rectangle containing the object ID.
				let resolvedObjectLabel = new fabric.Text(resolvedObject.id, {
					fontFamily: 'Calibri',
					fontSize: 16,
					textAlign: 'center',
					fill: 'white',
					selectable: false,
					top: this.getResolvedObjectTop(resolvedObject),
					left: this.timelineStart + offsetFromStart
				})

				if ((resolvedObjectLabel.width as number) <= (resolvedObjectRect.width as number)) {
					// Group rectangle and label.
					let resolvedObjectGroup = new fabric.Group([resolvedObjectRect, resolvedObjectLabel], {
						selectable: false
					})

					// Draw.
					this.canvas.add(resolvedObjectGroup)
					this.canvas.bringToFront(resolvedObjectGroup)
					this.timeLineObjects['timeEvents'].push(resolvedObjectGroup)
				} else {
					// Draw.
					this.canvas.add(resolvedObjectRect)
					this.canvas.bringToFront(resolvedObjectRect)
					this.timeLineObjects['timeEvents'].push(resolvedObjectRect)
				}
			}
		})
	}

	/**
	 * Finds the object with the earliest start time in a timeline and returns the time.
	 * @param {ResolvedTimeline} timeline Timeline to search.
	 * @returns Earliest starting time.
	 */
	findMinStartTime (timeline: ResolvedTimeline): number {
		// Store first start time as min.
		let min = timeline.resolved[0].resolved.startTime as number

		// Iterate through start times, if any time is earlier than current min, replace min.
		if (timeline.resolved.length > 1) {
			for (let _i = 1; _i < timeline.resolved.length; _i++) {
				// Not interested in undefined start times.
				if (timeline.resolved[_i].resolved.startTime === undefined || timeline.resolved[_i].resolved.endTime === null) {
					break
				} else {
					let time = timeline.resolved[_i].resolved.startTime as number

					min = (time < min) ? time : min
				}
			}
		}

		return min
	}

	/**
	 * Finds the object with the latest end time in a timeline and returns the time.
	 * @param {ResolvedTimeline} timeline Timeline to search.
	 * @returns Latest end time.
	 */
	findMaxEndTime (timeline: ResolvedTimeline): number {
		// Store first end time as max.
		let max = timeline.resolved[0].resolved.endTime as number

		// Iterate through start times, if any time is later than current max, replace max.
		if (timeline.resolved.length > 1) {
			for (let _i = 1; _i < timeline.resolved.length; _i++) {
				// Not interested in undefined end times.
				if (timeline.resolved[_i].resolved.endTime === undefined || timeline.resolved[_i].resolved.endTime === null) {
					break
				} else {
					let time = timeline.resolved[_i].resolved.endTime as number

					max = (time > max) ? time : max
				}
			}
		}

		return max
	}

	/**
	 * Calculated the offset, in pixels from the start of the timeline for an object.
	 * @param {TimelineResolvedObject} resolvedObject Object to calculate offset for.
	 * @returns Offset in pixels.
	 */
	getResolvedObjectOffsetFromTimelineStart (resolvedObject: TimelineResolvedObject): number {
		// Calculate offset.
		let offset = ((resolvedObject.resolved.startTime as number) - this.scaledDrawTimeStart) * this.pixelsWidthPerUnitTime

		// Offset cannot be to the left of the timeline start position.
		if (offset < 0) {
			offset = 0
		}

		return offset
	}

	/**
	 * Gets the end postion of a timeline object, relative to the start of the timeline.
	 * @param {TimelineResolvedObject} resolvedObject Object to calculate end position for.
	 * @returns End position, in pixels, relative to timeline start.
	 */
	getResolvedObjectEndPointFromTimelineStart (resolvedObject: TimelineResolvedObject): number {
		// Get object start and end times.
		let endTime = resolvedObject.resolved.endTime as number
		let startTime = resolvedObject.resolved.startTime as number

		// If the start time is less than the timeline start, set to timeline start.
		if (startTime < this.scaledDrawTimeStart) {
			startTime = this.scaledDrawTimeStart
		}

		// Calculate duration of the object remaining on the timeline.
		let duration = endTime - startTime

		// Return end point position in pixels.
		return duration * this.pixelsWidthPerUnitTime
	}

	/**
	 * Calculate the width, in pixels, of an object from its duration.
	 * @param {TimelineResolvedObject} resolvedObject Object to calculate width for.
	 * @returns Width in pixels.
	 */
	getResolvedObjectWidth (resolvedObject: TimelineResolvedObject): number {
		return (resolvedObject.resolved.outerDuration as number) * this.pixelsWidthPerUnitTime
	}

	/**
	 * Determines whether to show an object on the timeline.
	 * @param {TimelineResolvedObject} resolvedObject The object to check.
	 * @returns {true} if resolvedObject should be shown on the timeline.
	 */
	showObjectOnTimeline (resolvedObject: TimelineResolvedObject): boolean {
		let withinTimeline = (resolvedObject.resolved.startTime as number) >= this.scaledDrawTimeStart || (resolvedObject.resolved.endTime as number) <= this.scaledDrawTimeEnd
		let beforeTimeline = (resolvedObject.resolved.endTime as number) < this.scaledDrawTimeStart
		let afterTimeline = (resolvedObject.resolved.startTime as number) > this.scaledDrawTimeEnd

		return withinTimeline && !beforeTimeline && !afterTimeline
	}

	/**
	 * Calculate position of object from top of timeline according to its layer and type.
	 * @param {TimelineResolvedObject} resolvedObject Object to calculate position for.
	 * @returns Position relative to top of canvas in pixels.
	 */
	getResolvedObjectTop (resolvedObject: TimelineResolvedObject): number {
		let top = this.layers.indexOf(resolvedObject.LLayer.toString()) * this.rowHeight

		// Time-based events are placed at the bottom of a row.
		if (resolvedObject.trigger.type !== TriggerType.LOGICAL) {
			top += this.rowHeight / 3
		}

		return top
	}

	/**
	 * Handles mouse down event.
	 * @param opt Mouse event.
	 */
	canvasMouseDown (opt) {
		// Extract event.
		let event = opt.e

		// Store mouse is down.
		this.mouseDown = true

		// Store X position of mouse on click.
		this.mouseLastClickX = event.clientX

		// Prevent event.
		event.preventDefault()
		event.stopPropagation()
	}

	/**
	 * Handles mouse up event.
	 * @param opt Mouse event.
	 */
	canvasMouseUp (opt) {
		// Mouse no longer down.
		this.mouseDown = false
		// Reset scroll direction.
		this.lastScrollDirection = 0

		// Prevent event.
		opt.e.preventDefault()
		opt.e.stopPropagation()
	}

	/**
	 * Handles mouse movement on canvas.
	 * @param opt Mouse event.
	 */
	canvasMouseMove (opt) {
		// If mouse is down.
		if (this.mouseDown) {
			// Extract event.
			let event = opt.e

			// If we are beginning scrolling, we can move freely.
			if (this.lastScrollDirection === undefined || this.lastScrollDirection === 0) {
				// Store current mouse X.
				this.mouseLastX = event.clientX

				// Calculate change in X.
				let deltaX = event.clientX - this.mouseLastClickX

				// Store scrolling direction.
				if (deltaX < 0) {
					this.lastScrollDirection = -1
				} else {
					this.lastScrollDirection = 1
				}

				// Scroll to new X position.
				this.canvasScrollToX(deltaX)
			} else {
				// Calculate scroll direction.
				let direction = this.mouseLastX - event.clientX

				// If changing direction, store new direction but don't scroll.
				if (direction < 0 && this.lastScrollDirection === 1) {
					this.mouseLastClickX = event.clientX

					this.lastScrollDirection = -1
				} else if (direction > 0 && this.lastScrollDirection === -1) {
					this.mouseLastClickX = event.clientX

					this.lastScrollDirection = 1
				} else {
					// Calculate change in X.
					let deltaX = event.clientX - this.mouseLastClickX

					// Store last X position.
					this.mouseLastX = event.clientX

					// Move by change in X.
					this.canvasScrollToX(deltaX)
				}
			}
		}
	}

	/**
	 * Handles scroll wheel events on the canvas.
	 * @param opt Scroll event.
	 */
	canvasScrollWheel (opt) {
		// Extract event.
		let event = opt.e

		// Optimisation, don't rerender if no x-axis scrolling has occurred.
		if (event.deltaX !== 0) {
			// Pan.
			this.canvasScrollToX(event.deltaX * 10)
		}

		// CTRL + scroll to zoom.
		if (event.ctrlKey === true) {
			// If scrolling "up".
			if (event.deltaY > 0) {
				// Zoom in.
				this.timelineZoom = Math.max(this.timelineZoom - 10, 50)

				this.updateZoomValues()
				this.redrawTimeline(this.lastTimelineDrawn)
			} else if (event.deltaY < 0) {
				// Zoom out.
				this.timelineZoom = Math.min(this.timelineZoom + 10, 1000)

				this.updateZoomValues()
				this.redrawTimeline(this.lastTimelineDrawn)
			}
		}

		// Prevent event.
		event.preventDefault()
		event.stopPropagation()
	}

	/**
	 * Scroll across the canvas by a specified X value.
	 * @param {number} deltaX Value to move by.
	 */
	canvasScrollToX (deltaX: number): void {
		// Calculate new starting time.
		let targetStart = this.drawTimeStart + deltaX

		// Starting time cannot be < 0.
		if (targetStart < 0) {
			targetStart = 0
		}

		// Optimisation, don't redraw if nothing has changed.
		if (targetStart === this.drawTimeStart) {
			return
		}

		// Calculate end point.
		let targetEnd = targetStart + (this.drawTimeEnd - this.drawTimeStart)

		// Update timeline start and end values.
		this.drawTimeStart = targetStart
		this.drawTimeEnd = targetEnd

		// Update zoom.
		this.updateZoomValues()

		// Redraw timeline.
		this.redrawTimeline(this.lastTimelineDrawn)
	}

	/**
	 * Calculates the new scaled timeline start and end times according to the current zoom value.
	 */
	updateZoomValues () {
		this.scaledDrawTimeStart = this.drawTimeStart / (this.timelineZoom / 100)
		this.scaledDrawTimeEnd = this.drawTimeEnd * (this.timelineZoom / 100)
	}
}
