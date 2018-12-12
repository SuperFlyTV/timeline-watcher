import { fabric } from 'fabric'

import { Resolver, ResolvedTimeline, TimelineResolvedObject, TriggerType, UnresolvedTimeline, TimelineObject, TimelineState } from 'superfly-timeline'

/** Step size/ time step. */
const DEFAULT_STEP_SIZE = 1
/** Draw range (will be multiplied by DEFAULT_STEP_SIZE). */
const DEFAULT_DRAW_RANGE = 5000
/** Width of label column. */
const LABEL_WIDTH_OF_TIMELINE = 0.25
/** Default zoom */
const DEFAULT_ZOOM_VALUE = 100
/** Maximum zoom value */
const MAX_ZOOM_VALUE = 1000
/** Minimum zoom value */
const MIN_ZOOM_VALUE = 50
/** Factor to zoom by (zoom = ZOOM_FACTOR * STEP_SIZE) */
const ZOOM_FACTOR = 10
/** Factor to pan by (pan = PAN_FACTOR * STEP_SIZE) */
const PAN_FACTOR = 10

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

/** Logical object properties. */
const COLOR_LOGIC_OBJECT_FILL = 'rgba(255, 255, 102, 0.5)'
const COLOR_LOGIC_OBJECT_BORDER = 'rgba(255, 255, 0, 0.5)'
const THICKNESS_LOGIC_OBJECT_BORDER = 1

/** Time-based object properties. */
const COLOR_TIME_OBJECT_FILL = 'rgba(105, 35, 140, 0.5)'
const COLOR_TIME_OBJECT_BORDER = 'rgba(53, 17, 71, 0.5)'
const THICKNESS_TIME_OBJECT_BORDER = 1

/** Timeline object height as a proportion of the row height. */
const TIMELINE_OBJECT_HEIGHT = 2 / 3

/** END STYLING VALUES */

class LogicalObjectDrawTime {
	start: number
	end: number
}

class LogicalObjectDrawTimes {
	[id: string]: Array<LogicalObjectDrawTime>
}

class TimelineDictionary {
	[id: string]: TimelineResolvedObject
}

class LogicalObjectDictionary {
	[id: string]: TimelineObject
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

class ViewPort {
	timestamp?: number
	zoom?: number
	playing?: number
}

export class TimelineVisualizer {
	// Step size.
	public stepSize: number = DEFAULT_STEP_SIZE

	 /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
	private readonly _layerLabelWidthProportionOfCanvas = LABEL_WIDTH_OF_TIMELINE
	/** @private @readonly Default time range to display. */
	private readonly _defaultDrawRange = DEFAULT_DRAW_RANGE * this.stepSize

	// List of layers to display.
	private _layers: Array<string> = ['mainLayer', 'graphicsLayer', 'DSK', 'PSALayer']
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

	// Store the last timeline drawn, for redrawing and comparisons.
	private _lastTimelineDictionary: TimelineDictionary
	private _lastLogicalDictionary: LogicalObjectDictionary
	private _logicalObjectsDrawn: LogicalObjectDrawTimes

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

	// Store whether the mouse is held down, for scrolling.
	private _mouseDown: boolean

	// Last x positions of the mouse cursor (on click and on drag), for scrolling.
	private _mouseLastClickX: number
	private _mouseLastX: number

	// Last direction the user moved on the timeline, helps to smooth changing scroll direction.
	private _lastScrollDirection: number

	// Current zoom amount.
	private _timelineZoom: number

	/**
	 * @param {string} canvasId The ID of the canvas object to draw within.
	 */
	constructor (canvasId: string) {
		// Initialise other values.
		this._mouseDown = false
		this._timelineZoom = DEFAULT_ZOOM_VALUE
		this._lastTimelineDictionary = {}
		this._lastLogicalDictionary = {}
		this._logicalObjectsDrawn = {}

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

	initCanvas () {
		// Create new canvas object.
		this._canvas = new fabric.Canvas(this._canvasId)

		// Disable group selection.
		this._canvas.selection = false
		// Set cursor.
		this._canvas.hoverCursor = 'default'

		// Register canvas interaction event handlers.
		this._canvas.on('mouse:down', event => this.canvasMouseDown(event))
		this._canvas.on('mouse:up', event => this.canvasMouseUp(event))
		this._canvas.on('mouse:move', event => this.canvasMouseMove(event))
		this._canvas.on('mouse:wheel', event => this.canvasScrollWheel(event))

		// Get width and height of canvas.
		this._canvasWidth = this._canvas.getWidth()
		this._canvasHeight = this._canvas.getHeight()
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
		this._rowHeight = this.calculateRowHeight(this._layers)

		// Draw the layer labels.
		this.drawLayerLabels()

		// If the timeline contains any objects, draw.
		if (resolvedTimeline.resolved.length > 0) {
			this.drawInitialTimeline(resolvedTimeline)
		}
	}

	/**
	 * Updates the timeline, should be called when actions are added/removed from a timeline
	 * but the same timeline is being drawn.
	 * @param timeline Timeline to draw.
	 */
	updateTimeline (timeline: UnresolvedTimeline) {
		// Resolve the timeline.
		let resolvedTimeline = Resolver.getTimelineInWindow(timeline)

		// If the timeline contains any objects, draw.
		if (resolvedTimeline.resolved.length > 0) {
			this.drawInitialTimeline(resolvedTimeline)
		}
	}

	/**
	 * Sets the viewport to a position, zoom, and playback speed.
	 * Playback speed currently not implemented.
	 * @param viewPort Object to update viewport with.
	 */
	setViewPort (viewPort: ViewPort) {
		// Whether the viewport has changed.
		let changed = false

		// If timestamp has been specified.
		if (viewPort.timestamp !== undefined) {
			// Set start time to specified time.
			if (viewPort.timestamp > 0) {
				this._drawTimeStart = viewPort.timestamp
				this._drawTimeEnd = this._drawTimeStart + this._scaledDrawTimeRange

				changed = true
			}
		}

		// If zoom has been specified.
		if (viewPort.zoom !== undefined) {
			// Zoom to specified zoom.
			if (viewPort.zoom >= MIN_ZOOM_VALUE && viewPort.zoom <= MAX_ZOOM_VALUE) {
				this._timelineZoom = viewPort.zoom * this.stepSize
				this.updateScaledDrawTimeRange()
				this._drawTimeEnd = this._timelineStart + this._scaledDrawTimeRange
				changed = true
			}
		}

		// Redraw timeline if anything has changed.
		if (changed === true) {
			this.redrawTimeline()
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
	 * Gets all the logical objects present on the timeline.
	 * @param {ResolvedTimeline} timeline Timeline to get logical objects from.
	 * @returns {LogicalObjectDictionary} Logical objects by name.
	 */
	getLogicalObjectsFromTimeline (timeline: ResolvedTimeline): LogicalObjectDictionary {
		let objects: LogicalObjectDictionary = {}

		timeline.unresolved.forEach(obj => {
			if (obj.trigger.type === TriggerType.LOGICAL) {
				objects[obj.id as string] = obj
			}
		})

		return objects
	}

	/**
	 * Returns times where the timeline state changes.
	 * @param {ResolvedTimeline} timeline Timeline to find state changes from.
	 * @returns {Array<number>} Sorted list of state change times.
	 */
	getStateChangesFromTimeline (timeline: ResolvedTimeline): Array<number> {
		let changesOfState: {[time: number]: boolean} = {}

		// Always check state at 0.
		changesOfState[0] = true

		timeline.resolved.forEach(obj => {
			// Get start and end times for the object.
			let startTime = obj.resolved.startTime as number
			let endTime = obj.resolved.endTime as number

			changesOfState[startTime] = true
			changesOfState[endTime] = true
		})

		// Get max timeline time.
		let max = this.findMaxEndTime(timeline)

		// Always check max.
		changesOfState[max] = true

		// Convert dictionary to array.
		let sorted: Array<number> = []
		for (let key in changesOfState) {
			sorted[sorted.length] = Number(key)
		}

		// Return sorted list.
		return sorted.sort(function (a,b) {
			return a - b
		})
	}

	/**
	 * Resolves logical objects and returns the times that each logical object should be drawn.
	 * @param {ResolvedTimeline} timeline Timeline to draw logical objects from.
	 * @param {Array<number>} changesOfState List of times that the timeline changes state.
	 * @returns {LogicalObjectDrawTimes} Times to draw logical objects.
	 */
	resolveLogicalObjects (timeline: ResolvedTimeline, changesOfState: Array<number>): LogicalObjectDrawTimes {
		// Store list of active times for each object.
		let logicalObjectsActiveTimes: LogicalObjectDrawTimes = { }
		// Stores the last recorded state for each object.
		let logicalObjectsLastState: { [objName: string]: boolean } = { }

		// Go through each change of state.
		changesOfState.forEach(time => {
			// Get current state of the timeline.
			let timeLineState: TimelineState = Resolver.getState(timeline, time)

			// Go through all unresolved objects.
			timeline.unresolved.forEach(obj => {
				// Get the state of the logical object at this time.
				let objectState = Resolver.decipherLogicalValue(obj.trigger.value, obj, timeLineState, false) as boolean

				// If the object has not been recorded before, it needs to be added.
				if (logicalObjectsActiveTimes[obj.id as string] !== undefined) {
					// If object state has changed.
					if (objectState !== logicalObjectsLastState[obj.id as string] as boolean) {
						// If the new state is true.
						if (objectState === true) {
							// New start time.
							let drawTime = new LogicalObjectDrawTime()
							drawTime.start = time
							logicalObjectsActiveTimes[obj.id as string].push(drawTime)
						} else {
							// New end time.
							let drawTime = logicalObjectsActiveTimes[obj.id as string].pop() as LogicalObjectDrawTime
							drawTime.end = time - 1
							logicalObjectsActiveTimes[obj.id as string].push(drawTime)
						}
					}

					// Record last state
					logicalObjectsLastState[obj.id as string] = objectState
				} else {
					// Initialise active times array for object.
					logicalObjectsActiveTimes[obj.id as string] = []
					// Initialise last state for object.
					logicalObjectsLastState[obj.id as string] = objectState

					// If the current state is true.
					if (objectState === true) {
						// Add new start time.
						let drawTime = new LogicalObjectDrawTime()
						drawTime.start = time
						logicalObjectsActiveTimes[obj.id].push(drawTime)
					}
				}
			})
		})

		return logicalObjectsActiveTimes
	}

	/**
	 * Calculates the height to give to each row to fit all layers on screen.
	 * @param {Array<string>} layers List of layers to use.
	 * @returns Number of layers.
	 */
	calculateRowHeight (layers: Array<string>): number {
		return this._canvasHeight / layers.length
	}

	/**
	 * Draws the layer labels to the canvas.
	 */
	drawLayerLabels () {
		// Iterate through layers.
		for (let _i = 0; _i < this._layers.length; _i++) {
			// this.timeLineObjects.layerLabels[this.layers[_i]] = []
			// Create a background rectangle.
			let layerRect = new fabric.Rect({
				left: 0,
				top: _i * this._rowHeight,
				fill: COLOR_LABEL_BACKGROUND,
				width: this._layerLabelWidth,
				height: this._rowHeight,
				selectable: false,
				name: this._layers[_i]
			})

			// Create label.
			let layerText = new fabric.Text(this._layers[_i], {
				width: this._layerLabelWidth,
				fontFamily: TEXT_FONT_FAMILY,
				fontSize: TEXT_FONT_SIZE,
				textAlign: 'left',
				fill: TEXT_COLOR,
				selectable: false,
				top: (_i * this._rowHeight) + (this._rowHeight / 2),
				name: this._layers[_i]
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
				// this.timeLineObjects.layerLabels[layerText.text as string].push(layerGroup)
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
		// this.updateZoomValues()
		this.updateScaledDrawTimeRange()

		// Set timeline start and end times.
		this._drawTimeStart = 0
		this._drawTimeEnd = this._drawTimeStart + this._scaledDrawTimeRange

		// Set timeline object height.
		this._timelineObjectHeight = this._rowHeight * TIMELINE_OBJECT_HEIGHT

		// Create a dictionary out of timeline objects for indexing by name.
		let timelineDictionary: TimelineDictionary = {}
		timeline.resolved.forEach(object => {
			timelineDictionary[object.id as string] = object
		})

		// Create fabric objects for all time-based objects.
		this.createTimeBasedFabricObjects(timeline)

		// Get logical objects on timeline.
		let logicalObjects = this.getLogicalObjectsFromTimeline(timeline)

		// Resolve logical objects.
		let drawTimes = this.resolveLogicalObjects(timeline, this.getStateChangesFromTimeline(timeline))

		// Create fabirc objects for all logic-based objects.
		this.createLogicBasedFabricObjects(drawTimes)

		// Store the objects to draw.
		this._lastTimelineDictionary = timelineDictionary
		this._lastLogicalDictionary = logicalObjects
		this._logicalObjectsDrawn = drawTimes

		// Draw timeline.
		this.redrawTimeline()
	}

	/**
	 * Redraws the timeline to the canvas.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 */
	redrawTimeline () {
		// Calculate how many pixels are required per unit time.
		this._pixelsWidthPerUnitTime = this._timelineWidth / (this._drawTimeEnd - this._drawTimeStart)

		// Get states for time-based and logical objects.
		let timeStates = this.getTimelineTimeDrawState(this._lastTimelineDictionary)
		let logicalStates = this.getTimelineLogicalDrawState(this._lastLogicalDictionary, this._logicalObjectsDrawn)

		// Draw the current state.
		this.drawTimelineState({ ...timeStates, ...logicalStates })
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
	 * Returns the draw states for all time-based objects.
	 * @param {TimelineDictionary} timelineDictionary Dictionary of time-based objects.
	 * @returns {TimelineDrawState} State of time-based objects.
	 */
	getTimelineTimeDrawState (timelineDictionary: TimelineDictionary): TimelineDrawState {
		let currentDrawState: TimelineDrawState = {}

		for (let id in timelineDictionary) {

			currentDrawState[id] = this.createStateForObject(timelineDictionary[id], timelineDictionary[id].resolved.startTime as number, timelineDictionary[id].resolved.endTime as number)
		}

		return currentDrawState
	}

	/**
	 * Returns the draw states for all logical objects.
	 * @param {LogicalObjectDictionary} logicalObjectDictionary Dictionary of logical objects.
	 * @param {LogicalObjectDrawTimes} logicalObjectDrawTimes Times to draw.
	 * @returns {TimelineDrawState} State of logical objects.
	 */
	getTimelineLogicalDrawState (logicalObjectDictionary: LogicalObjectDictionary, logicalObjectDrawTimes: LogicalObjectDrawTimes): TimelineDrawState {
		let currentDrawState: TimelineDrawState = {}

		for (let name in logicalObjectDrawTimes) {
			for (let _i = 0; _i < logicalObjectDrawTimes[name].length; _i++) {
				currentDrawState[name + _i] = this.createStateForObject(logicalObjectDictionary[name], logicalObjectDrawTimes[name][_i].start, logicalObjectDrawTimes[name][_i].end)
			}
		}

		return currentDrawState
	}

	/**
	 * Creates a draw sstate for a timeline object.
	 * @param {TimelineObject} object Object to draw.
	 * @param {number} start Start time.
	 * @param {number} end End time.
	 * @returns {DrawState} State of the object to draw.
	 */
	createStateForObject (object: TimelineObject, start: number, end: number): DrawState {
		// Default state (hidden).
		let state: DrawState = { height: 0, left: 0, top: 0, width: 0, visible: false }

		// State should be default if the object is not being shown.
		if (this.showOnTimeline(start, end)) {
			// Get object dimensions and position.
			let objectOffset = this.getObjectOffsetFromTimelineStart(start)
			let objectWidth = this.getObjectWidth(start, end)
			let objectTop = this.getObjectOffsetFromTop(object)

			// If offset is before timeline, reduce width and set offset to 0.
			if (objectOffset < 0) {
				objectWidth += objectOffset
				objectOffset = 0
			}

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
	 * Creates all the fabric objects for time-based objects.
	 * @param {ResolvedTimeline} timeline Objects to draw.
	 */
	createTimeBasedFabricObjects (timeline: ResolvedTimeline) {
		timeline.resolved.forEach(element => {
			let resolvedObjectRect = new fabric.Rect({
				left: 0,
				width: 0,
				height: 0,
				top: 0,
				fill: COLOR_TIME_OBJECT_FILL,
				stroke: COLOR_TIME_OBJECT_BORDER,
				strokeWidth: THICKNESS_TIME_OBJECT_BORDER,
				selectable: false,
				visible: false,
				name: element.id as string
			})

			let resolvedObjectLabel = new fabric.Text(element.id, {
				fontFamily: TEXT_FONT_FAMILY,
				fontSize: TEXT_FONT_SIZE,
				textAlign: 'center',
				fill: TEXT_COLOR,
				selectable: false,
				top: 0,
				left: 0,
				visible: false,
				name: element.id as string
			})

			this._canvas.add(resolvedObjectRect)
			this._canvas.add(resolvedObjectLabel)
		})
	}

	/**
	 * Creates all the fabric objects for logical objects.
	 * @param {LogicalObjectDrawTimes} logicalObjectDrawTimes Times to draw.
	 */
	createLogicBasedFabricObjects (logicalObjectDrawTimes: LogicalObjectDrawTimes) {
		for (let name in logicalObjectDrawTimes) {
			for (let _i = 0; _i < logicalObjectDrawTimes[name].length; _i++) {
				// Create a rectangle representing object duration.
				let resolvedObjectRect = new fabric.Rect({
					left: 0,
					width: 0,
					height: 0,
					top: 0,
					fill: COLOR_LOGIC_OBJECT_FILL,
					stroke: COLOR_LOGIC_OBJECT_BORDER,
					strokeWidth: THICKNESS_LOGIC_OBJECT_BORDER,
					selectable: false,
					visible: false,
					name: name + _i
				})

				// Add a label to the rectangle containing the object ID.
				let resolvedObjectLabel = new fabric.Text(name, {
					fontFamily: TEXT_FONT_FAMILY,
					fontSize: TEXT_FONT_SIZE,
					textAlign: 'center',
					fill: TEXT_COLOR,
					selectable: false,
					top: 0,
					left: 0,
					visible: false,
					name: name + _i
				})

				this._canvas.add(resolvedObjectRect)
				this._canvas.add(resolvedObjectLabel)
			}
		}
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
	 * @param {TimelineResolvedObject} resolvedObject The object to check.
	 * @returns {true} if resolvedObject should be shown on the timeline.
	 */
	showObjectOnTimeline (resolvedObject: TimelineResolvedObject): boolean {
		return this.showOnTimeline(resolvedObject.resolved.startTime as number, resolvedObject.resolved.endTime as number)
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
	 * Calculate position of object from top of timeline according to its layer and type.
	 * @param {TimelineObject} object Object to calculate position for.
	 * @returns Position relative to top of canvas in pixels.
	 */
	getObjectOffsetFromTop (object: TimelineObject): number {
		let top = this._layers.indexOf(object.LLayer.toString()) * this._rowHeight

		// Time-based events are placed at the bottom of a row.
		if (object.trigger.type !== TriggerType.LOGICAL) {
			top += this._rowHeight / 3
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
		this._mouseDown = true

		// Store X position of mouse on click.
		this._mouseLastClickX = event.clientX

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
		this._mouseDown = false
		// Reset scroll direction.
		this._lastScrollDirection = 0

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
		if (this._mouseDown) {
			// Extract event.
			let event = opt.e

			// If we are beginning scrolling, we can move freely.
			if (this._lastScrollDirection === undefined || this._lastScrollDirection === 0) {
				// Store current mouse X.
				this._mouseLastX = event.clientX

				// Calculate change in X.
				let deltaX = event.clientX - this._mouseLastClickX

				// Store scrolling direction.
				if (deltaX < 0) {
					this._lastScrollDirection = -1
				} else {
					this._lastScrollDirection = 1
				}

				// Scroll to new X position.
				this.canvasScrollByDeltaX(-deltaX)
			} else {
				// Calculate scroll direction.
				let direction = this._mouseLastX - event.clientX

				// If changing direction, store new direction but don't scroll.
				if (direction < 0 && this._lastScrollDirection === 1) {
					this._mouseLastClickX = event.clientX

					this._lastScrollDirection = -1
				} else if (direction > 0 && this._lastScrollDirection === -1) {
					this._mouseLastClickX = event.clientX

					this._lastScrollDirection = 1
				} else {
					// Calculate change in X.
					let deltaX = event.clientX - this._mouseLastClickX

					// Store last X position.
					this._mouseLastX = event.clientX

					// Move by change in X.
					this.canvasScrollByDeltaX(-deltaX)
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

		// Get mouse pointer coordinates on canvas.
		let canvasCoord = this._canvas.getPointer(event.e)

		// Don't scroll if mouse is not over timeline.
		if (canvasCoord.x <= this._timelineStart) {
			return
		}

		// CTRL + scroll to zoom.
		if (event.ctrlKey === true) {
			// If scrolling "up".
			if (event.deltaY > 0) {
				// Zoom out.
				this._timelineZoom = Math.min(this._timelineZoom + (ZOOM_FACTOR * this.stepSize), MAX_ZOOM_VALUE * this.stepSize)

				// Zoom relative to cursor position.
				this.zoomUnderCursor(canvasCoord.x)
				this.redrawTimeline()
			} else if (event.deltaY < 0) {
				// Zoom in.
				this._timelineZoom = Math.max(this._timelineZoom - (ZOOM_FACTOR * this.stepSize), MIN_ZOOM_VALUE * this.stepSize)

				// Zoom relative to cursor position.
				this.zoomUnderCursor(canvasCoord.x)
				this.redrawTimeline()
			}
		} else if (event.deltaX !== 0) { // Optimisation, don't rerender if no x-axis scrolling has occurred.
			// Pan.
			this.canvasScrollByDeltaX(-(event.deltaX * (PAN_FACTOR * this.stepSize)))
		}

		// Prevent event.
		event.preventDefault()
		event.stopPropagation()
	}

	/**
	 * Scroll across the canvas by a specified X value.
	 * @param {number} deltaX Value to move by.
	 */
	canvasScrollByDeltaX (deltaX: number) {
		// Calculate new starting time.
		let targetStart = this._drawTimeStart + deltaX

		// Starting time cannot be < 0.
		if (targetStart < 0) {
			targetStart = 0
		}

		// Optimisation, don't redraw if nothing has changed.
		if (targetStart === this._drawTimeStart) {
			return
		}

		// Calculate end point.
		let targetEnd = targetStart + this._scaledDrawTimeRange

		// Update timeline start and end values.
		this._drawTimeStart = targetStart
		this._drawTimeEnd = targetEnd

		// Redraw timeline.
		this.redrawTimeline()
	}

	/**
	 * Calculates the new scaled timeline start and end times according to the current zoom value.
	 */
	updateScaledDrawTimeRange () {
		this._scaledDrawTimeRange = this._drawTimeRange * (this._timelineZoom / 100)
	}

	/**
	 * Zooms into/out of timeline, keeping the time under the cursor in the same position.
	 * @param cursorX Position of mouse cursor.
	 */
	zoomUnderCursor (cursorX: number) {
		// Get time under cursor.
		let coordToTime = this.cursorPosToTime(cursorX)

		// Calculate position of mouse relative to edges of timeline.
		let ratio = this.getCursorPositionAcrossTimeline(cursorX)

		// Set zoom values.
		this.updateScaledDrawTimeRange()

		// Calculate start and end values.
		let targetStart = coordToTime - (ratio * this._scaledDrawTimeRange)
		let targetEnd = targetStart + this._scaledDrawTimeRange

		// Start cannot be less than 0 but we must preserve the time range to draw.
		if (targetStart < 0) {
			let diff = -targetStart
			targetStart = 0
			targetEnd += diff
		}

		// Set draw times.
		this._drawTimeStart = targetStart
		this._drawTimeEnd = targetEnd
	}

	/**
	 * Gets the current time under the mouse cursor.
	 * @param cursorX Mouse cursor position (x-axis).
	 * @returns Time under cursor, or -1 if the cursor is not over the timeline.
	 */
	cursorPosToTime (cursorX: number): number {
		// Check if over timeline.
		if (cursorX <= this._timelineStart || cursorX >= this._timelineStart + this._timelineWidth) {
			return -1
		}

		let ratio = this.getCursorPositionAcrossTimeline(cursorX)

		return this._drawTimeStart + (this._scaledDrawTimeRange * ratio)
	}

	/**
	 * Gets the position of the mouse cursor as a percentage of the width of the timeline.
	 * @param cursorX Mouse cursor position.
	 * @returns Cursor position relative to timeline width, or -1 if the cursor is not over the timeline.
	 */
	getCursorPositionAcrossTimeline (cursorX: number): number {
		// Check if over timeline.
		if (cursorX <= this._timelineStart || cursorX >= this._timelineStart + this._timelineWidth) {
			return -1
		}

		let diffX = cursorX - this._timelineStart
		let ratio = diffX / this._timelineWidth

		return ratio
	}
}
