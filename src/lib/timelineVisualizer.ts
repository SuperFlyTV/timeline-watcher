import { fabric } from 'fabric'

import { Resolver, TimelineObject, ResolveOptions, ResolvedTimeline, ResolvedTimelineObjects, TimelineObjectInstance, ResolvedTimelineObject } from 'superfly-timeline'

/** Step size/ time step. */
const DEFAULT_STEP_SIZE = 1
/** Draw range (will be multiplied by DEFAULT_STEP_SIZE). */
const DEFAULT_DRAW_RANGE = 200
/** Width of label column. */
const LABEL_WIDTH_OF_TIMELINE = 0.25
/** Default zoom */
const DEFAULT_ZOOM_VALUE = 100

/** BEGIN STYLING VALUES */

/** Timeline background color. */
const COLOR_BACKGROUND = 'grey'

/** Layer label background color. */
const COLOR_LABEL_BACKGROUND = 'black'

/** Color of line separating timeline rows. */
const COLOR_LINE = 'black'
/** Height of line separating rows. */
const THICKNESS_LINE = 1

/** Text properties. */
const TEXT_FONT_FAMILY = 'Calibri'
const TEXT_FONT_SIZE = 16
const TEXT_COLOR = 'white'

/** Timeline object properties. */
const COLOR_TIMELINE_OBJECT_FILL = 'rgba(105, 35, 140, 0.5)'
const COLOR_TIMELINE_OBJECT_BORDER = 'rgba(53, 17, 71, 0.5)'
const THICKNESS_TIMELINE_OBJECT_BORDER = 1

/** Timeline object height as a proportion of the row height. */
const TIMELINE_OBJECT_HEIGHT = 2 / 3

/** END STYLING VALUES */

class ResolvedLayers {
	[layer: string]: Array<string>
}

class TimelineDrawState {
	[id: string]: DrawState
}

class DrawState {
	width: number
	height: number
	left: number
	top: number
	visible: boolean
}

export class TimelineVisualizer {
	// Step size.
	public stepSize: number = DEFAULT_STEP_SIZE

	 /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
	 private readonly _layerLabelWidthProportionOfCanvas = LABEL_WIDTH_OF_TIMELINE
	 /** @private @readonly Default time range to display. */
	private readonly _defaultDrawRange = DEFAULT_DRAW_RANGE * this.stepSize

	// Timeline currently drawn.
	private _resolvedTimeline: ResolvedTimeline

	// Width of column of layer labels.
	private _layerLabelWidth: number

	// Canvas ID.
	private _canvasId: string
	// Canvas to draw to.
	private _canvas: fabric.Canvas

	// Width and height of the canvas, in pixels.
	private _canvasWidth: number
	private _canvasHeight: number

	// Height of a timeline row, in pixels.
	private _rowHeight: number

	// Last maximum time.
	// private _lastMaxTime: number

	// Width of the actual timeline within the canvas, in pixels.
	private _timelineWidth: number
	// Start and end of the timeline relative to the left of the canvas, in pixels.
	private _timelineStart: number

	// Height of objects to draw.
	private _timelineObjectHeight: number

	// Start and end time of the current view. Defines the objects within view on the timeline.
	private _drawTimeStart: number
	private _drawTimeEnd: number
	// Current range of times to draw.
	private _drawTimeRange: number

	// Scaled timeline start and end, according to zoom.
	private _scaledDrawTimeRange: number

	// Width of an object per unit time of duration.
	private _pixelsWidthPerUnitTime: number

	// Current zoom amount.
	private _timelineZoom: number

	/**
	 * @param {string} canvasId The ID of the canvas object to draw within.
	 */
	constructor (canvasId: string) {
		this._timelineZoom = DEFAULT_ZOOM_VALUE

		this._canvasId = canvasId

		this.initCanvas()

		// Calculate width of label column.
		this._layerLabelWidth = this._canvasWidth * this._layerLabelWidthProportionOfCanvas

		// Calculate timeline width and start point.
		this._timelineWidth = this._canvasWidth - this._layerLabelWidth
		this._timelineStart = this._layerLabelWidth

		// Draw background.
		let background = new fabric.Rect({
			left: 0,
			top: 0,
			fill: COLOR_BACKGROUND,
			width: this._canvasWidth,
			height: this._canvasHeight,
			selectable: false
		})
		this._canvas.add(background)
	}

	/**
	 * Initialises the canvas and registers canvas events.
	 */
	initCanvas () {
		// Create new canvas object.
		this._canvas = new fabric.Canvas(this._canvasId)

		// Disable group selection.
		this._canvas.selection = false
		// Set cursor.
		this._canvas.hoverCursor = 'default'

		// Register canvas interaction event handlers.
		// this._canvas.on('mouse:down', event => this.canvasMouseDown(event))
		// this._canvas.on('mouse:up', event => this.canvasMouseUp(event))
		// this._canvas.on('mouse:move', event => this.canvasMouseMove(event))
		// this._canvas.on('mouse:wheel', event => this.canvasScrollWheel(event))

		// Get width and height of canvas.
		this._canvasWidth = this._canvas.getWidth()
		this._canvasHeight = this._canvas.getHeight()
	}

	/**
	 * Sets the timeline to draw.
	 * @param {TimelineObject[]} timeline Timeline to draw.
	 * @param {ResolveOptions} options Options to use for resolving timeline state.
	 */
	setTimeline (timeline: TimelineObject[], options: ResolveOptions) {
		// Resolve timeline.
		this._resolvedTimeline = Resolver.resolveTimeline(timeline, options)

		// Calculate height of rows based on number of layers.
		// In future layers will be pulled from the timeline.
		this._rowHeight = this.calculateRowHeight(this._resolvedTimeline.layers)

		// Draw the layer labels.
		this.drawLayerLabels()

		// If the timeline contains any objects, draw.
		if (Object.keys(this._resolvedTimeline.objects).length > 0) {
			this.drawInitialTimeline(this._resolvedTimeline)
		}
	}

	/**
	 * Calculates the height to give to each row to fit all layers on screen.
	 * @param {ResolvedLayers} layers Map of layers to use.
	 * @returns Height of rows.
	 */
	calculateRowHeight (layers: ResolvedLayers): number {
		return this._canvasHeight / Object.keys(layers).length
	}

	/**
	 * Draws the layer labels to the canvas.
	 */
	drawLayerLabels () {
		// Store layers to draw.
		let layers = Object.keys(this._resolvedTimeline.layers)

		// Iterate through layers.
		for (let _i = 0; _i < layers.length; _i++) {
			// Create a background rectangle.
			let layerRect = new fabric.Rect({
				left: 0,
				top: _i * this._rowHeight,
				fill: COLOR_LABEL_BACKGROUND,
				width: this._layerLabelWidth,
				height: this._rowHeight,
				selectable: false,
				name: layers[_i]
			})

			// Create label.
			let layerText = new fabric.Text(layers[_i], {
				width: this._layerLabelWidth,
				fontFamily: TEXT_FONT_FAMILY,
				fontSize: TEXT_FONT_SIZE,
				textAlign: 'left',
				fill: TEXT_COLOR,
				selectable: false,
				top: (_i * this._rowHeight) + (this._rowHeight / 2),
				name: layers[_i]
			})

			// If this is the topmost label, draw to screen.
			// Otherwise, add a line between rows.
			if (_i === 0) {
				// Group background and label.
				let layerGroup = new fabric.Group([layerRect, layerText], {
					selectable: false
				})

				// Draw.
				this._canvas.add(layerGroup)
				// this.timeLineObjects.layerLabels[layerText.text as string].push(layerGroup)
			} else {
				// Create line.
				let layerLine = new fabric.Rect({
					left: this._layerLabelWidth,
					top: _i * this._rowHeight,
					fill: COLOR_LINE,
					width: this._timelineWidth,
					height: THICKNESS_LINE,
					selectable: false,
					name: 'Line'
				})

				// Group background, label, and line.
				let layerGroup = new fabric.Group([layerRect, layerText, layerLine], {
					selectable: false
				})

				// Draw.
				this._canvas.add(layerGroup)
			}
		}
	}

	/**
	 * Draws the timeline initially.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 */
	drawInitialTimeline (timeline: ResolvedTimeline) {
		// Set time range.
		this._drawTimeRange = this._defaultDrawRange

		// Calculate new zoom values.
		this.updateScaledDrawTimeRange()

		// Set timeline start and end times.
		this._drawTimeStart = 0
		this._drawTimeEnd = this._drawTimeStart + this._scaledDrawTimeRange

		// Set timeline object height.
		this._timelineObjectHeight = this._rowHeight * TIMELINE_OBJECT_HEIGHT

		// Create fabric objects for all time-based objects.
		this.createTimelineFabricObjects(timeline.objects)

		// Store the objects to draw.
		// this._lastMaxTime = this.findMaxEndTime(timeline)

		// Draw timeline.
		this.redrawTimeline()
	}

	/**
	 * Redraws the timeline to the canvas.
	 */
	redrawTimeline () {
		// Calculate how many pixels are required per unit time.
		this._pixelsWidthPerUnitTime = this._timelineWidth / (this._drawTimeEnd - this._drawTimeStart)

		let timeLineState = this.getTimelineDrawState(this._resolvedTimeline)

		// Draw the current state.
		this.drawTimelineState(timeLineState)
	}

	/**
	 * Draws a timeline state to the canvas.
	 * @param {TimelineDrawState} currentDrawState State to draw.
	 */
	drawTimelineState (currentDrawState: TimelineDrawState) {
		// Iterate through cavas.
		// Seemingly the only way to update objects without clearing the canvas.
		this._canvas.getObjects().forEach(element => {
			if (element.name !== undefined) {
				// Only interested in fabric.Rect and fabric.Text
				if (element.type === 'rect' || element.type === 'text') {
					// Check element is affected by current state.
					// Note: This allows for partial updates.
					if (element.name in currentDrawState) {
						let state = currentDrawState[element.name]

						// Text objects shouldn't have their dimensions modified.
						if (element.type === 'text') {
							element.set({
								top: state.top,
								left: state.left,
								// Only show if text fits within timeline object.
								visible: ((element.width as number) <= state.width) ? state.visible : false
							})
						} else {
							element.set({
								height: state.height,
								left: state.left,
								top: state.top,
								width: state.width,
								visible: state.visible
							})
						}
					}
				}
			}
		})

		// Tell canvas to re-render all objects.
		this._canvas.renderAll()
	}

	/**
	 * Returns the draw states for all timeline objects.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 * @returns {TimelineDrawState} State of time-based objects.
	 */
	getTimelineDrawState (timeline: ResolvedTimeline): TimelineDrawState {
		let currentDrawState: TimelineDrawState = {}

		for (let key in timeline.objects) {
			let timeObj = timeline.objects[key] as ResolvedTimelineObject
			let parentID = timeObj.id

			for (let _i = 0; _i < timeObj.resolved.instances.length; _i++) {
				let instanceObj = timeObj.resolved.instances[_i]
				let name = parentID + ':' + (instanceObj.id as string)

				currentDrawState[name] = this.createStateForObject(parentID, instanceObj.start as number, instanceObj.end as number)
			}
		}

		return currentDrawState
	}

	/**
	 * Creates a draw state for a timeline object.
	 * @param {string} parentID Name of the object's parent.
	 * @param {number} start Start time.
	 * @param {number} end End time.
	 * @returns {DrawState} State of the object to draw.
	 */
	createStateForObject (parentID: string, start: number, end: number): DrawState {
		// Default state (hidden).
		let state: DrawState = { height: 0, left: 0, top: 0, width: 0, visible: false }
		// State should be default if the object is not being shown.
		if (this.showOnTimeline(start, end)) {
			// Get object dimensions and position.
			let objectWidth = this.getObjectWidth(start, end)
			let objectTop = this.getObjectOffsetFromTop(parentID)

			// Set state properties.
			state.height = this._timelineObjectHeight
			state.left = this._timelineStart + this.getObjectOffsetFromTimelineStart(start)
			state.top = objectTop
			state.width = objectWidth
			state.visible = true
		}

		return state
	}

	/**
	 * Creates a draw state for a timeline object.
	 * @param {TimelineObjectInstance} object Object to draw.
	 * @param {string} parentName Name of the object's parent (the object the instance belongs to).
	 */
	createFabricObject (object: TimelineObjectInstance, parentName: string) {
		// Create name from parent name and instance name.
		let name = parentName + ':' + (object.id as string)

		let resolvedObjectRect = new fabric.Rect({
			left: 0,
			width: 0,
			height: 0,
			top: 0,
			fill: COLOR_TIMELINE_OBJECT_FILL,
			stroke: COLOR_TIMELINE_OBJECT_BORDER,
			strokeWidth: THICKNESS_TIMELINE_OBJECT_BORDER,
			selectable: false,
			visible: false,
			name: name
		})

		let resolvedObjectLabel = new fabric.Text(name, {
			fontFamily: TEXT_FONT_FAMILY,
			fontSize: TEXT_FONT_SIZE,
			textAlign: 'center',
			fill: TEXT_COLOR,
			selectable: false,
			top: 0,
			left: 0,
			visible: false,
			name: name
		})

		this._canvas.add(resolvedObjectRect)
		this._canvas.add(resolvedObjectLabel)
	}

	/**
	 * Creates all the fabric objects for time-based objects.
	 * @param {ResolvedTimelineObjects} timeline Objects to draw.
	 */
	createTimelineFabricObjects (timeline: ResolvedTimelineObjects) {
		for (let key in timeline) {
			// Store timeline object to save on array indexing.
			let timeObj = timeline[key]

			for (let _i = 0; _i < timeline[key].resolved.instances.length; _i++) {
				this.createFabricObject(timeObj.resolved.instances[_i], timeObj.id)
			}
		}
	}

	/**
	 * Finds the object with the latest end time in a timeline and returns the time.
	 * @param {ResolvedTimeline} timeline Timeline to search.
	 * @returns Latest end time.
	 */
	findMaxEndTime (timeline: ResolvedTimeline): number {
		// Store first end time as max.
		let max = timeline.objects[0].resolved.instances[0].end as number

		// Iterate through start times, if any time is later than current max, replace max.
		if (Object.keys(timeline.objects).length > 1) {
			for (let key in timeline.objects) {
				for (let _i = 1; _i < timeline.objects[key].resolved.instances.length; _i++) {
					if (timeline.objects[key].resolved.instances[_i].end === undefined || timeline.objects[key].resolved.instances[_i].end === null) {
						break
					} else {
						let time = timeline.objects[key].resolved.instances[_i].end as number

						max = (time > max) ? time : max
					}
				}
			}
		}

		return max
	}

	/**
	 * Calculates the offset, in pixels from the start of the timeline for an object.
	 * @param {number} start start time of the object.
	 * @returns {number} Offset in pixels.
	 */
	getObjectOffsetFromTimelineStart (start: number): number {
		// Calculate offset.
		let offset = (start - this._drawTimeStart) * this._pixelsWidthPerUnitTime

		// Offset cannot be to the left of the timeline start position.
		if (offset < 0) {
			offset = 0
		}

		return offset
	}

	/**
	 * Calculates the width, in pixels, of an object based on its duration.
	 * @param {number} start Start time of the object.
	 * @param {number} end End time of the object.
	 * @returns {number} Width in pixels.
	 */
	getObjectWidth (start: number, end: number): number {
		// Get object start and end times.
		let endTime = end
		let startTime = start

		// If the start time is less than the timeline start, set to timeline start.
		if (startTime < this._drawTimeStart) {
			startTime = this._drawTimeStart
		}

		// Calculate duration of the object remaining on the timeline.
		let duration = endTime - startTime

		// Return end point position in pixels.
		return duration * this._pixelsWidthPerUnitTime
	}

	/**
	 * Determines whether to show an object on the timeline.
	 * @param {number} start Object start time.
	 * @param {number} end Object end time.
	 * @returns {true} if object should be shown on the timeline.
	 */
	showOnTimeline (start: number, end: number) {
		let withinTimeline = start >= this._drawTimeStart || end <= this._drawTimeEnd
		let duringTimeline = this._drawTimeStart > start && this._drawTimeEnd < end
		let beforeTimeline = end < this._drawTimeStart
		let afterTimeline = start > this._drawTimeEnd

		// return withinTimeline && !beforeTimeline && !afterTimeline
		return (withinTimeline || duringTimeline) && !beforeTimeline && !afterTimeline
	}

	/**
	 * Calculate position of object instance from top of timeline according to its layer.
	 * @param {string} parentID Name of object to which this instance belongs.
	 * @returns Position relative to top of canvas in pixels.
	 */
	getObjectOffsetFromTop (parentID: string): number {
		let top = 0

		// Iterate through layers and find the one that contains this object's parent.
		for (let key in this._resolvedTimeline.layers) {
			if (this._resolvedTimeline.layers[key].indexOf(parentID) !== -1) {
				// Calculate offset.
				top = top * this._rowHeight
				break
			} else {
				top++
			}
		}

		return top
	}

	/**
	 * Calculates the new scaled timeline start and end times according to the current zoom value.
	 */
	updateScaledDrawTimeRange () {
		this._scaledDrawTimeRange = this._drawTimeRange * (this._timelineZoom / 100)
	}
}
