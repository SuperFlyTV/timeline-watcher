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

	// List of all objects displayed on the timeline.
	private timeLineObjects: {[layer: string]: Array<fabric.Object>} = {}

	// Width of the actual timeline within the canvas, in pixels.
	private timelineWidth: number
	// Start and end of the timeline relative to the left of the canvas, in pixels.
	private timelineStart: number

	// Start and end time of the current view. Defines the objects within view on the timeline.
	private drawTimeStart: number
	private drawTimeEnd: number

	// Width of an object per unit time of duration.
	private pixelsWidthPerUnitTime: number

	/**
	 * @param {string} canvasId The ID of the canvas object to draw within.
	 */
	constructor (canvasId: string) {
		// Initialise map of canvas objects.
		this.timeLineObjects['background'] = []
		this.timeLineObjects['layerLabels'] = []
		this.timeLineObjects['timeEvents'] = []
		this.timeLineObjects['logicalEvents'] = []

		// Create new canvas object.
		this.canvas = new fabric.Canvas(canvasId)

		// Disable group selection.
		this.canvas.selection = false
		// Set cursor.
		this.canvas.hoverCursor = 'default'

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

		// Calculate how many pixels are required per unit time.
		this.pixelsWidthPerUnitTime = this.timelineWidth / (this.drawTimeEnd - this.drawTimeStart)

		// Iterate through TimelineResolvedObject in timeline.
		timeline.resolved.forEach(resolvedObject => {
			// Create a rectangle representing object duration.
			let resolvedObjectRect = new fabric.Rect({
				left: this.timelineStart + this.getResolvedObjectOffsetFromTimelineStart(resolvedObject),
				width: this.getResolvedObjectWidth(resolvedObject),
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
				textAlign: 'right',
				fill: 'white',
				selectable: false,
				top: this.getResolvedObjectTop(resolvedObject),
				left: this.timelineStart + this.getResolvedObjectOffsetFromTimelineStart(resolvedObject)
			})

			// Group rectangle and label.
			let resolvedObjectGroup = new fabric.Group([resolvedObjectRect, resolvedObjectLabel], {
				selectable: false
			})

			// Draw.
			this.canvas.add(resolvedObjectGroup)
			this.canvas.bringToFront(resolvedObjectGroup)
			this.timeLineObjects['timeEvents'].push(resolvedObjectGroup)
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
		return ((resolvedObject.resolved.startTime as number) - this.drawTimeStart) * this.pixelsWidthPerUnitTime
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
}
