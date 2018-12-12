import { fabric } from 'fabric'

import { Resolver, ResolvedTimeline, TimelineResolvedObject, TriggerType, UnresolvedTimeline, TimelineObject, TimelineState } from 'superfly-timeline'

class LogicalObjectDrawTime {
	start: number
	end: number
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

export class TimelineVisualizer {
	 /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
	private readonly layerLabelWidthProportionOfCanvas = 0.25
	/** @private @readonly Default time range to display. */
	private readonly defaultDrawRange = 5000

	// List of layers to display.
	private layers: Array<string> = ['mainLayer', 'graphicsLayer', 'DSK', 'PSALayer']
	// Width of column of layer labels.
	private layerLabelWidth: number

	// Canvas ID.
	private canvasId: string
	// Canvas to draw to.
	private canvas: fabric.Canvas

	// Width and height of the canvas, in pixels.
	private canvasWidth: number
	private canvasHeight: number

	// Height of a timeline row, in pixels.
	private rowHeight: number

	// Store the last timeline drawn, for redrawing and comparisons.
	// private lastTimelineDrawn: ResolvedTimeline
	private lastTimelineDictionary: TimelineDictionary
	private lastLogicalDictionary: LogicalObjectDictionary
	private logicalObjectsDrawn: {[objName: string]: Array<LogicalObjectDrawTime>}

	// List of all objects displayed on the timeline.
	/*private timeLineObjects: {
		background: fabric.Object | undefined
		layerLabels: Array<fabric.Group>
		timeEvents: {[name: string]: fabric.Rect}
		timeEventsLabels: {[name: string]: fabric.Text}
		logicalEvents: {[name: string]: fabric.Rect}
		logicalEventsLabels: {[name: string]: fabric.Text}
	} = {
		background: undefined,
		layerLabels: [],
		timeEvents: {},
		timeEventsLabels: {},
		logicalEvents: {},
		logicalEventsLabels: {}
	}*/

	// Width of the actual timeline within the canvas, in pixels.
	private timelineWidth: number
	// Start and end of the timeline relative to the left of the canvas, in pixels.
	private timelineStart: number

	// Start and end time of the current view. Defines the objects within view on the timeline.
	private drawTimeStart: number
	private drawTimeEnd: number
	// Current range of times to draw.
	private drawTimeRange: number

	// Scaled timeline start and end, according to zoom.
	private scaledDrawTimeRange: number

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
		/*this.timeLineObjects.background = undefined
		this.timeLineObjects.layerLabels = []
		this.timeLineObjects.timeEvents = {}
		this.timeLineObjects.logicalEvents = {}*/

		// Initialise other values.
		this.mouseDown = false
		this.timelineZoom = 100
		// this.lastTimelineDictionary = {}

		this.canvasId = canvasId

		this.initCanvas()

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
		// this.timeLineObjects.background = background
	}

	initCanvas () {
		// Create new canvas object.
		this.canvas = new fabric.Canvas(this.canvasId)

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
			/*this.drawInitialTimeline(resolvedTimeline)

			let stateChanges = this.getStateChangesFromTimeline(resolvedTimeline)

			let logicalDrawTimes = this.resolveLogicalObjects(resolvedTimeline, stateChanges)

			this.drawLogicalObjects(resolvedTimeline, logicalDrawTimes)

			// Store last timeline drawn.
			this.lastTimelineDrawn = resolvedTimeline
			this.logicalObjectsDrawn = logicalDrawTimes*/

			this.drawInitialTimeline(resolvedTimeline)

			// this.lastTimelineDrawn = resolvedTimeline
			// this.logicalObjectsDrawn = logicalDrawTimes
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
			this.redrawTimeline()

			// Store last timeline drawn.
			// this.lastTimelineDrawn = resolvedTimeline
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

	getLogicalObjectsFromTimeline (timeline: ResolvedTimeline): LogicalObjectDictionary {
		let objects: LogicalObjectDictionary = {}

		timeline.unresolved.forEach(obj => {
			if (obj.trigger.type === TriggerType.LOGICAL) {
				objects[obj.id as string] = obj
			}
		})

		return objects
	}

	getStateChangesFromTimeline (timeline: ResolvedTimeline): Array<number> {
		let changesOfState: Array<number> = []

		changesOfState.push(0)

		timeline.resolved.forEach(obj => {
			let startTime = obj.resolved.startTime as number
			let endTime = obj.resolved.endTime as number

			if (changesOfState.indexOf(startTime) === -1) {
				changesOfState.push(startTime)

				if (changesOfState.indexOf(startTime - 1) === -1) {
					changesOfState.push(startTime - 1)
				}

				if (changesOfState.indexOf(startTime + 1) === -1) {
					changesOfState.push(startTime + 1)
				}
			}

			if (changesOfState.indexOf(endTime) === -1) {
				changesOfState.push(endTime)

				if (changesOfState.indexOf(endTime - 1) === -1) {
					changesOfState.push(endTime - 1)
				}

				if (changesOfState.indexOf(endTime + 1) === -1) {
					changesOfState.push(endTime + 1)
				}
			}
		})

		let max = this.findMaxEndTime(timeline)

		if (changesOfState.indexOf(max) === -1) {
			changesOfState.push(max)
		}

		return changesOfState.sort(function (a, b) {
			return a - b
		})
	}

	createTimeBasedFabricObjects (timeline: ResolvedTimeline) {
		timeline.resolved.forEach(element => {
			let resolvedObjectRect = new fabric.Rect({
				left: 0,
				width: 0,
				height: 0,
				top: 0,
				fill: 'rgba(105, 35, 140, 0.5)',
				stroke: 'rgba(53, 17, 71, 0.5)',
				strokeWidth: 1,
				selectable: false,
				visible: false,
				name: element.id as string
			})

			let resolvedObjectLabel = new fabric.Text(element.id, {
				fontFamily: 'Calibri',
				fontSize: 16,
				textAlign: 'center',
				fill: 'white',
				selectable: false,
				top: 0,
				left: 0,
				visible: false,
				name: element.id as string
			})

			this.canvas.add(resolvedObjectRect)
			this.canvas.add(resolvedObjectLabel)
		})
	}

	resolveLogicalObjects (timeline: ResolvedTimeline, changesOfState: Array<number>): {[objName: string]: Array<LogicalObjectDrawTime>} {
		let logicalObjectsActiveTimes: { [objName: string]: Array<LogicalObjectDrawTime> } = { '': [] }
		let logicalObjectsLastState: { [objName: string]: boolean } = { '': false }

		changesOfState.forEach(time => {
			let timeLineState: TimelineState = Resolver.getState(timeline, time)
			timeline.unresolved.forEach(obj => {
				let objectState = Resolver.decipherLogicalValue(obj.trigger.value, obj, timeLineState, false) as boolean

				if (logicalObjectsActiveTimes[obj.id as string] !== undefined) {
					if (objectState !== logicalObjectsLastState[obj.id as string] as boolean) {
						if (objectState === true) {
							let drawTime = new LogicalObjectDrawTime()
							drawTime.start = time
							logicalObjectsActiveTimes[obj.id as string].push(drawTime)
						} else {
							let drawTime = logicalObjectsActiveTimes[obj.id as string].pop() as LogicalObjectDrawTime
							drawTime.end = time - 1
							logicalObjectsActiveTimes[obj.id as string].push(drawTime)
						}
					}

					logicalObjectsLastState[obj.id as string] = objectState
				} else {
					logicalObjectsActiveTimes[obj.id as string] = []
					logicalObjectsLastState[obj.id as string] = objectState

					if (objectState === true) {
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
		return this.canvasHeight / layers.length
	}

	/**
	 * Draws the layer labels to the canvas.
	 */
	drawLayerLabels () {
		// Iterate through layers.
		for (let _i = 0; _i < this.layers.length; _i++) {
			// this.timeLineObjects.layerLabels[this.layers[_i]] = []
			// Create a background rectangle.
			let layerRect = new fabric.Rect({
				left: 0,
				top: _i * this.rowHeight,
				fill: 'black',
				width: this.layerLabelWidth,
				height: this.rowHeight,
				selectable: false,
				name: this.layers[_i]
			})

			// Create label.
			let layerText = new fabric.Text(this.layers[_i], {
				width: this.layerLabelWidth,
				fontFamily: 'Calibri',
				fontSize: 16,
				textAlign: 'left',
				fill: 'white',
				selectable: false,
				top: (_i * this.rowHeight) + (this.rowHeight / 2),
				name: this.layers[_i]
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
				// this.timeLineObjects.layerLabels[layerText.text as string].push(layerGroup)
			} else {
				// Create line.
				let layerLine = new fabric.Rect({
					left: this.layerLabelWidth,
					top: _i * this.rowHeight,
					fill: 'black',
					width: this.timelineWidth,
					height: 1,
					selectable: false,
					name: 'Line'
				})

				// Group background, label, and line.
				let layerGroup = new fabric.Group([layerRect, layerText, layerLine], {
					selectable: false
				})

				// Draw.
				this.canvas.add(layerGroup)
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
		this.drawTimeRange = this.defaultDrawRange

		// Calculate new zoom values.
		// this.updateZoomValues()
		this.updateScaledDrawTimeRange()

		// Set timeline start and end times.
		this.drawTimeStart = 0
		this.drawTimeEnd = this.drawTimeStart + this.scaledDrawTimeRange

		let timelineDictionary: TimelineDictionary = {}
		timeline.resolved.forEach(object => {
			timelineDictionary[object.id as string] = object
		})
		this.createTimeBasedFabricObjects(timeline)

		let logicalObjects = this.getLogicalObjectsFromTimeline(timeline)

		let drawTimes = this.resolveLogicalObjects(timeline, this.getStateChangesFromTimeline(timeline))

		this.createLogicBasedFabricObjects(drawTimes)

		this.drawTimeline(timelineDictionary)
		this.drawLogicalObjects(logicalObjects, drawTimes)

		this.lastTimelineDictionary = timelineDictionary
		this.lastLogicalDictionary = logicalObjects
		this.logicalObjectsDrawn = drawTimes
	}

	/**
	 * Redraws the timeline to the canvas.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 */
	redrawTimeline () {
		this.drawTimeline(this.lastTimelineDictionary)
		this.drawLogicalObjects(this.lastLogicalDictionary, this.logicalObjectsDrawn)
	}

	/**
	 * Draws a timeline to the canvas.
	 * @param {ResolvedTimeline} timeline Timeline to draw.
	 */
	drawTimeline (timelineDictionary: TimelineDictionary) {
		// Don't draw an empty timeline.
		if (timelineDictionary === {}) {
			return
		}

		// Calculate how many pixels are required per unit time.
		this.pixelsWidthPerUnitTime = this.timelineWidth / (this.drawTimeEnd - this.drawTimeStart)

		let currentDrawState: TimelineDrawState = {}
		let height = (this.rowHeight / 3) * 2

		for (let id in timelineDictionary) {
			let state: DrawState = { height: 0, left: 0, top: 0, width: 0, visible: false }
			if (this.showObjectOnTimeline(timelineDictionary[id])) {
				let offset = this.getResolvedObjectOffsetFromTimelineStart(timelineDictionary[id])
				let width = this.getResolvedObjectWidth(timelineDictionary[id])

				if (offset < 0) {
					width += offset
					offset = 0
				}

				state.height = height
				state.left = this.timelineStart + offset
				state.top = this.getResolvedObjectTop(timelineDictionary[id])
				state.width = width
				state.visible = true

				if (state.left < 0) {
					state.width += state.left
				}
			}

			currentDrawState[id] = state
		}

		this.canvas.getObjects().forEach(element => {
			if (element.name !== undefined) {
				if (element.type === 'rect' || element.type === 'text') {
					if (element.name in currentDrawState) {
						let state = currentDrawState[element.name]
						if (element.type === 'text') {
							element.set({
								top: state.top,
								left: state.left,
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

		this.canvas.renderAll()
	}

	drawLogicalObjects (logicalObjectDictionary: LogicalObjectDictionary, logicalObjectDrawTimes: {[objName: string]: Array<LogicalObjectDrawTime>}) {
		if (logicalObjectDrawTimes === {} || logicalObjectDictionary === {}) {
			return
		}

		let height = 2 * (this.rowHeight / 3)

		let currentDrawState: TimelineDrawState = {}

		for (let name in logicalObjectDrawTimes) {
			for (let _i = 0; _i < logicalObjectDrawTimes[name].length; _i++) {
				let state = { height: 0, left: 0, top: 0, width: 0, visible: false }

				if (this.showOnTimeline(logicalObjectDrawTimes[name][_i].start, logicalObjectDrawTimes[name][_i].end)) {
					let start = logicalObjectDrawTimes[name][_i].start
					let end = logicalObjectDrawTimes[name][_i].end
					let offset = this.getObjectOffsetFromTimelineStart(start)
					let width = this.getObjectEndPointFromTimelineStart(start, end)
					let top = this.getUnresolvedObjectTop(logicalObjectDictionary[name])

					if (offset < 0) {
						width += offset
						offset = 0
					}

					state.height = height
					state.left = this.timelineStart + this.getObjectOffsetFromTimelineStart(start)
					state.top = top
					state.width = width
					state.visible = true

					currentDrawState[name + _i] = state
				}

				currentDrawState[name + _i] = state
			}
		}

		this.canvas.getObjects().forEach(element => {
			if (element.name !== undefined) {
				if (element.type === 'text' || element.type === 'rect') {
					if (element.name in currentDrawState) {
						let state = currentDrawState[element.name]
						if (element.type === 'text') {
							element.set({
								top: state.top,
								left: state.left,
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

		this.canvas.renderAll()
		/*for (let name in LogicalObjectDrawTimes) {
			LogicalObjectDrawTimes[name].forEach(drawTime => {
				let timelineObj = this.getLogicalTimelineObjectByName(timeline, name)
				if (this.showOnTimeline(drawTime.start, drawTime.end)) {
					let offsetFromStart = this.getObjectOffsetFromTimelineStart(drawTime.start)

					let objectWidth = this.getObjectEndPointFromTimelineStart(drawTime.start, drawTime.end)

					let top = this.getUnresolvedObjectTop(timelineObj)

					if (offsetFromStart < 0) {
						objectWidth += offsetFromStart
						offsetFromStart = 0
					}

					// Create a rectangle representing object duration.
					let resolvedObjectRect = new fabric.Rect({
						left: this.timelineStart + offsetFromStart,
						width: objectWidth,
						height: this.rowHeight * (2 / 3),
						top: top,
						fill: 'rgba(255, 255, 102, 0.5)',
						stroke: 'rgba(255, 255, 0, 0.5)',
						strokeWidth: 1,
						selectable: false
					})

					// Add a label to the rectangle containing the object ID.
					let resolvedObjectLabel = new fabric.Text(name, {
						fontFamily: 'Calibri',
						fontSize: 16,
						textAlign: 'center',
						fill: 'white',
						selectable: false,
						top: top,
						left: this.timelineStart + offsetFromStart
					})

					// Group rectangle and label.
					let resolvedObjectGroup = new fabric.Group([resolvedObjectRect, resolvedObjectLabel], {
						selectable: false
					})

					// Draw.
					this.canvas.add(resolvedObjectGroup)
					this.canvas.bringToFront(resolvedObjectGroup)
					// this.timeLineObjects.logicalEvents[resolvedObjectLabel.text as string].push(resolvedObjectGroup)
				}
			})
		}*/
	}

	getLogicalTimelineObjectByName (timeline: ResolvedTimeline, name: string): TimelineObject {
		for (let _i = 0; _i < timeline.unresolved.length; _i++) {
			if ((timeline.unresolved[_i].id as string) === name) {
				return timeline.unresolved[_i]
			}
		}

		return { id: 'undefined', trigger: { type: -1, value: -1 }, LLayer: -1, content: [] }
	}

	createLogicBasedFabricObjects (logicalObjectDrawTimes: {[objName: string]: Array<LogicalObjectDrawTime>}) {
		for (let name in logicalObjectDrawTimes) {
			for (let _i = 0; _i < logicalObjectDrawTimes[name].length; _i++) {
				// Create a rectangle representing object duration.
				let resolvedObjectRect = new fabric.Rect({
					left: 0,
					width: 0,
					height: 0,
					top: 0,
					fill: 'rgba(255, 255, 102, 0.5)',
					stroke: 'rgba(255, 255, 0, 0.5)',
					strokeWidth: 1,
					selectable: false,
					visible: false,
					name: name + _i
				})

				// Add a label to the rectangle containing the object ID.
				let resolvedObjectLabel = new fabric.Text(name, {
					fontFamily: 'Calibri',
					fontSize: 16,
					textAlign: 'center',
					fill: 'white',
					selectable: false,
					top: 0,
					left: 0,
					visible: false,
					name: name + _i
				})

				this.canvas.add(resolvedObjectRect)
				this.canvas.add(resolvedObjectLabel)
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
	 * Calculated the offset, in pixels from the start of the timeline for an object.
	 * @param {TimelineResolvedObject} resolvedObject Object to calculate offset for.
	 * @returns Offset in pixels.
	 */
	getResolvedObjectOffsetFromTimelineStart (resolvedObject: TimelineResolvedObject): number {
		// Calculate offset.
		let offset = ((resolvedObject.resolved.startTime as number) - this.drawTimeStart) * this.pixelsWidthPerUnitTime

		// Offset cannot be to the left of the timeline start position.
		/*if (offset < 0) {
			offset = 0
		}*/

		return offset
	}

	getObjectOffsetFromTimelineStart (start: number): number {
		// Calculate offset.
		let offset = (start - this.drawTimeStart) * this.pixelsWidthPerUnitTime

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
		if (startTime < this.drawTimeStart) {
			startTime = this.drawTimeStart
		}

		// Calculate duration of the object remaining on the timeline.
		let duration = endTime - startTime

		// Return end point position in pixels.
		return duration * this.pixelsWidthPerUnitTime
	}

	getObjectEndPointFromTimelineStart (start: number, end: number): number {
		// Get object start and end times.
		let endTime = end
		let startTime = start

		// If the start time is less than the timeline start, set to timeline start.
		if (startTime < this.drawTimeStart) {
			startTime = this.drawTimeStart
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
		let withinTimeline = (resolvedObject.resolved.startTime as number) >= this.drawTimeStart || (resolvedObject.resolved.endTime as number) <= this.drawTimeEnd
		let duringTimeline = this.drawTimeStart > (resolvedObject.resolved.startTime as number) && this.drawTimeEnd < (resolvedObject.resolved.endTime as number)
		let beforeTimeline = (resolvedObject.resolved.endTime as number) < this.drawTimeStart
		let afterTimeline = (resolvedObject.resolved.startTime as number) > this.drawTimeEnd

		// return withinTimeline && !beforeTimeline && !afterTimeline
		return (withinTimeline || duringTimeline) && !beforeTimeline && !afterTimeline
	}

	showOnTimeline (start: number, end: number) {
		let withinTimeline = start >= this.drawTimeStart || end <= this.drawTimeEnd
		let duringTimeline = this.drawTimeStart > start && this.drawTimeEnd < end
		let beforeTimeline = end < this.drawTimeStart
		let afterTimeline = start > this.drawTimeEnd

		// return withinTimeline && !beforeTimeline && !afterTimeline
		return (withinTimeline || duringTimeline) && !beforeTimeline && !afterTimeline
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

	getUnresolvedObjectTop (object: TimelineObject): number {
		let top = this.layers.indexOf(object.LLayer.toString()) * this.rowHeight

		// Time-based events are placed at the bottom of a row.
		if (object.trigger.type !== TriggerType.LOGICAL) {
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
				this.canvasScrollByDeltaX(-deltaX)
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
		let canvasCoord = this.canvas.getPointer(event.e)

		// Don't scroll if mouse is not over timeline.
		if (canvasCoord.x <= this.timelineStart) {
			return
		}

		// CTRL + scroll to zoom.
		if (event.ctrlKey === true) {
			// If scrolling "up".
			if (event.deltaY > 0) {
				// Zoom out.
				this.timelineZoom = Math.min(this.timelineZoom + 10, 1000)

				// Zoom relative to cursor position.
				this.zoomUnderCursor(canvasCoord.x)
				this.redrawTimeline()
			} else if (event.deltaY < 0) {
				// Zoom in.
				this.timelineZoom = Math.max(this.timelineZoom - 10, 50)

				// Zoom relative to cursor position.
				this.zoomUnderCursor(canvasCoord.x)
				this.redrawTimeline()
			}
		} else if (event.deltaX !== 0) { // Optimisation, don't rerender if no x-axis scrolling has occurred.
			// Pan.
			this.canvasScrollByDeltaX(-(event.deltaX * 10))
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
		let targetEnd = targetStart + this.scaledDrawTimeRange

		// Update timeline start and end values.
		this.drawTimeStart = targetStart
		this.drawTimeEnd = targetEnd

		// Redraw timeline.
		this.redrawTimeline()
	}

	/**
	 * Calculates the new scaled timeline start and end times according to the current zoom value.
	 */
	updateScaledDrawTimeRange () {
		this.scaledDrawTimeRange = this.drawTimeRange * (this.timelineZoom / 100)
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
		let targetStart = coordToTime - (ratio * this.scaledDrawTimeRange)
		let targetEnd = targetStart + this.scaledDrawTimeRange

		// Start cannot be less than 0 but we must preserve the time range to draw.
		if (targetStart < 0) {
			let diff = -targetStart
			targetStart = 0
			targetEnd += diff
		}

		// Set draw times.
		this.drawTimeStart = targetStart
		this.drawTimeEnd = targetEnd
	}

	/**
	 * Gets the current time under the mouse cursor.
	 * @param cursorX Mouse cursor position (x-axis).
	 * @returns Time under cursor, or -1 if the cursor is not over the timeline.
	 */
	cursorPosToTime (cursorX: number): number {
		// Check if over timeline.
		if (cursorX <= this.timelineStart || cursorX >= this.timelineStart + this.timelineWidth) {
			return -1
		}

		let ratio = this.getCursorPositionAcrossTimeline(cursorX)

		return this.drawTimeStart + (this.scaledDrawTimeRange * ratio)
	}

	/**
	 * Gets the position of the mouse cursor as a percentage of the width of the timeline.
	 * @param cursorX Mouse cursor position.
	 * @returns Cursor position relative to timeline width, or -1 if the cursor is not over the timeline.
	 */
	getCursorPositionAcrossTimeline (cursorX: number): number {
		// Check if over timeline.
		if (cursorX <= this.timelineStart || cursorX >= this.timelineStart + this.timelineWidth) {
			return -1
		}

		let diffX = cursorX - this.timelineStart
		let ratio = diffX / this.timelineWidth

		return ratio
	}
}
