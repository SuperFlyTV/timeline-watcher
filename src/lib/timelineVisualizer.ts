import * as isEqual from 'lodash.isequal'

import {
	Resolver,
	TimelineObject,
	ResolveOptions,
	ResolvedTimelineObjects,
	TimelineObjectInstance,
	ResolvedTimelineObject,
	ResolvedStates
} from 'superfly-timeline'
import { EventEmitter } from 'events'

/** Step size/ time step. */
const DEFAULT_STEP_SIZE = 1

/** Width of label column. */
const LABEL_WIDTH_OF_TIMELINE = 0.25
/** Default zoom */
const DEFAULT_ZOOM_VALUE = 100
/** Factor to zoom by */
const ZOOM_FACTOR = 1.001
/** Factor to pan by (pan = PAN_FACTOR * STEP_SIZE) */
const PAN_FACTOR = 10

/** Maximum layer height */
const MAX_LAYER_HEIGHT = 60

/** Amount to move playhead per second. */
const DEFAULT_PLAYHEAD_SPEED = 1

/** BEGIN STYLING VALUES */

/** Timeline background color. */
const COLOR_BACKGROUND = '#333333'

/** Layer label background color. */
const COLOR_LABEL_BACKGROUND = '#666666'

/** Ruler header bar background colour */
const COLOR_RULER_HEADER = '#111111'
/** Color of the ruler lines */
const RULER_LINE_COLOR = '#999999'
/** Height of ruler header bar */
const RULER_HEADER_HEIGHT = 25
/** Width of the ruler lines */
const RULER_LINE_WIDTH = 1

/** Playhead color. */
const COLOR_PLAYHEAD = 'rgba(255, 0, 0, 0.5)'

/** Playhead thickness. */
const THICKNESS_PLAYHEAD = 5

/** Color of line separating timeline rows. */
const COLOR_LINE = 'black'
/** Height of line separating rows. */
const THICKNESS_LINE = 1

/** Text properties. */
const TEXT_FONT_FAMILY = 'Calibri'
const TEXT_FONT_SIZE = 16
const TEXT_COLOR = 'white'

/** Timeline object properties. */
const COLOR_TIMELINE_OBJECT_FILL = 'rgb(22, 102, 247, 0.75)'
const COLOR_TIMELINE_OBJECT_BORDER = 'rgba(232, 240, 255, 0.85)'
const THICKNESS_TIMELINE_OBJECT_BORDER = 1

/** Timeline object height as a proportion of the row height. */
const TIMELINE_OBJECT_HEIGHT = 1

/** END STYLING VALUES */

/** BEGIN CONSTANTS FOR STATE MANAGEMENT */

const MOUSEIN = 0
const MOUSEOUT = 1

/**  CONSTANTS FOR STATE MANAGEMENT */

export interface TimelineDrawState {
	[id: string]: DrawState
}

export interface DrawState {
	width: number
	height: number
	left: number
	top: number
	visible: boolean
	title: string
}

/**
 * Allows the viewort of the timeline to be set.
 */
export interface ViewPort {
	/** Timestamp to move the start of the timeline to. */
	timestamp?: number
	/** Factor to zoom in on the timeline. */
	zoom?: number
	/** Whether the playhead should be moving. */
	playPlayhead?: boolean
	/** Move the playhead to a specified time. */
	playheadTime: number
	/** Whether the viewport is playing */
	playViewPort?: boolean
	/** The speed to use when playing */
	playSpeed?: number
}

export interface TimelineVisualizerOptions {
	/** Whether to draw the playhead or not */
	drawPlayhead?: boolean
}
type Layers = {[layer: string]: number} // the content is the index/offset

/**
 * Stores the times to trim a timeline between.
 */
export interface TrimProperties {
	start?: number
	end?: number
}

/**
 * Stores the object currently being hovered over.
 */
export interface HoveredObject {
	object: TimelineObject,
	instance: TimelineObjectInstance,
	pointer: { xPostion: number, yPosition: number }
}

/**
 * Used when splitting up the name of a timeline object to separate out the data stored within the name.
 */
export interface TimelineObjectMetaData {
	type: string
	name: string
	instance: string
}

/**
 * Stores the start and enod poins of an object on a timeline.
 */
export interface HoverMapData {
	startX: number
	endX: number
	name: string
	objectRefId: string
	type: string
	instanceId: string
}

/**
 * Stores a map of objects from the timeline displayed on the canvas.
 * layer = layer *name*.
 */
export interface TimelineHoverMap {[layer: string]: HoverMapData[]}

export class TimelineVisualizer extends EventEmitter {
	// Step size.
	public stepSize: number = DEFAULT_STEP_SIZE

	/** @private @readonly Proportion of the canvas to be used for the layer labels column. */
	private readonly _layerLabelWidthProportionOfCanvas = LABEL_WIDTH_OF_TIMELINE

	/** Timeline currently drawn. */
	private _resolvedStates: ResolvedStates | undefined
	/** Layers on timeline. */
	private _layerLabels: Layers = {}
	/** State of the timeline. */
	private _timelineState: TimelineDrawState = {}
	/** Map of objects for determining hovered object */
	private _hoveredObjectMap: TimelineHoverMap = {}

	/** Width of column of layer labels. */
	private _layerLabelWidth: number

	/** Canvas ID. */
	private _canvasId: string
	/** Canvas HTML container. */
	private _canvasContainer: HTMLCanvasElement
	/** Canvas to draw to. */
	private _canvas: CanvasRenderingContext2D

	/** Width of the canvas [pixels] */
	private _canvasWidth: number
	/** Height of the canvas [pixels] */
	private _canvasHeight: number

	/** Height of a timeline row [pixels] */
	private _rowHeight: number

	/** Height of all of the rows. */
	private _rowsTotalHeight: number

	/** Number of layers. */
	private _numberOfLayers: number

	/** Width of the actual drawing-view within the canvas [pixels] */
	private _viewDrawWidth: number
	// Timeline offset from top of canvas, in pixels.
	private _timelineTop: number
	// Height of timeline, in pixels.
	private _timelineHeight: number

	/** Start of the drawing-view relative to the left of the canvas [pixels] */
	private _viewDrawX: number

	// /** Current range of times to draw. */
	// private _drawTimeRange: number = DEFAULT_DRAW_RANGE

	/** Height of objects to draw [pixels] */
	private _timelineObjectHeight: number

	/** Start time of the current view. Defines the objects within view on the timeline [time] */
	private _viewStartTime: number = 0
	/** Range of the current view [time] */
	// private _viewTimeRange: number = 1
	// private _drawTimeEnd: number

	/** Store whether the mouse is held down, for scrolling. */
	private _mouseDown: boolean = false

	/** Last x positions of the mouse cursor (on click and on drag), for scrolling. */
	private _mouseLastX: number

	/** Last direction the user moved on the timeline, helps to smooth changing scroll direction. */
	private _lastScrollDirection: number

	/** Current zoom amount. */
	private _timelineZoom: number = DEFAULT_ZOOM_VALUE

	/** Whether or not the playhead should move. */
	private _playHeadPlaying: boolean = false

	/** Whether or not the viewport should move */
	private _playViewPort: boolean

	/** Whether to draw the playhead or not */
	private _drawPlayhead: boolean
	/** Speed of the playhead [units / second] */
	private _playSpeed: number = DEFAULT_PLAYHEAD_SPEED
	/** The current time position of the playhead. */
	private _playHeadTime: number = 0

	/** The last time updateDraw() did a draw. */
	private _updateDrawLastTime: number = 0

	/** The object currently being hovered over. */
	private _hoveredOver: HoveredObject | undefined
	/** Whether the mouse last moved over an object or out. */
	private _lastHoverAction: number = MOUSEOUT
	/** Name of object that was last hovered over. */
	private _lastHoveredHash: string = ''

	/** If the visualizer automatically should re-resolve the timeline when navigating the viewport */
	private _timelineResolveAuto: boolean = false
	/** At what time the timeline was resolved [time] */
	private _timelineResolveStart: number = 0
	private _timelineResolveEnd: number = 0
	private _timelineResolveZoom: number = 1
	private _timelineResolveCount: number = 100
	private _timelineResolveCountAdjust: number = 1

	/** How much extra (outside the current viewport) the timeline should be resolved to [ratio] */
	private _timelineResolveExpand: number = 3

	private latestTimeline: TimelineObject[]
	private latestUpdateTime: number = 0
	private latestOptions: ResolveOptions
	private reresolveTimeout: NodeJS.Timer | null = null
	private _mergeIterator: number = 0

	/**
	 * @param {string} canvasId The ID of the canvas object to draw within.
	 */
	constructor (canvasId: string, options: TimelineVisualizerOptions = {}) {
		super()

		// Initialise other values.
		this._canvasId = canvasId

		this.initCanvas()

		this._drawPlayhead = !!options.drawPlayhead

		// Calculate width of label column.
		this._layerLabelWidth = this._canvasWidth * this._layerLabelWidthProportionOfCanvas

		// Calculate timeline width and start point.
		this._viewDrawX = this._layerLabelWidth
		this._viewDrawWidth = this._canvasWidth - this._layerLabelWidth
		this._timelineTop = RULER_HEADER_HEIGHT
		this._timelineHeight = this._canvasHeight - this._timelineTop

		// Draw background.
		this.drawBackground()

		// Draw playhead.
		this.drawPlayhead()

		this.updateDraw()
	}

	/**
	 * Initialises the canvas and registers canvas events.
	 */
	private initCanvas () {
		// Create new canvas object.
		this._canvasContainer = document.getElementById(this._canvasId) as HTMLCanvasElement

		if (!this._canvasContainer) throw new Error(`Canvas "${this._canvasId}" not found`)

		// Get rendering context.
		this._canvas = this._canvasContainer.getContext('2d') as CanvasRenderingContext2D

		// Register canvas interaction event handlers.
		this._canvasContainer.addEventListener('mousedown', (event) => this.canvasMouseDown(event))
		this._canvasContainer.addEventListener('mouseup', (event) => this.canvasMouseUp(event))
		this._canvasContainer.addEventListener('mousemove', (event) => this.canvasMouseMove(event))
		this._canvasContainer.addEventListener('wheel', (event) => this.canvasScrollWheel(event))

		// Get width and height of canvas.
		this._canvasWidth = this._canvasContainer.width
		this._canvasHeight = this._canvasContainer.height
	}

	/**
	 * Updates the timeline, should be called when actions are added/removed from a timeline
	 * but the same timeline is being drawn.
	 * @param {TimelineObject[]} timeline Timeline to draw.
	 * @param {ResolveOptions} options Resolve options.
	 */
	public updateTimeline (timeline: TimelineObject[], options?: ResolveOptions) {
		// If options have not been specified set time to 0.
		if (options === undefined) {
			options = {
				time: 0,
				limitCount: 10
			}
		}
		this.latestTimeline = timeline
		this.latestOptions = options

		if (!options.limitTime) {
			this._timelineResolveAuto = true
		} else {
			this._timelineResolveAuto = false
		}

		const options2 = {
			...options
		}

		if (this._timelineResolveAuto) {
			this.updateTimelineResolveWindow()
		}
		if (this._resolvedStates === undefined) { // If first time this runs

			// Set timeline start and end times.
			if (options2.time !== undefined) {
				this._viewStartTime = options2.time
			}
			// Move playhead to start time.
			this._playHeadTime = this._viewStartTime
		}
		this._updateTimeline(true)
	}
	private _updateTimeline (fromNewTimeline: boolean = false) {

		const options2 = {
			...this.latestOptions
		}
		if (this._timelineResolveAuto) {

			options2.time = this._timelineResolveStart
			options2.limitTime = this._timelineResolveEnd

			options2.limitCount = Math.ceil(this._timelineResolveCount * this._timelineResolveCountAdjust)
		}

		// If the playhead is being drawn, the resolve time should be at the playhead time.
		if (this._drawPlayhead && this._playHeadTime > options2.time) {
			options2.time = this._playHeadTime
		}

		// Resolve the timeline.
		const startResolve = Date.now()
		const resolvedTimeline = Resolver.resolveTimeline(this.latestTimeline, options2)
		let newResolvedStates = Resolver.resolveAllStates(resolvedTimeline)

		if (this._resolvedStates === undefined) { // If first time this runs
			this._resolvedStates = newResolvedStates
		} else {

			if (this._drawPlayhead) {
				// Trim the current timeline:
				if (newResolvedStates) {

					// Merge the timelines.
					this._resolvedStates = this.mergeTimelineObjects(this._resolvedStates, newResolvedStates, fromNewTimeline)
				}
			} else {
				// Otherwise we only see one timeline at a time.
				// Overwrite the previous timeline:
				this._resolvedStates = newResolvedStates
			}
		}

		// Update layers.
		this.updateLayerLabels()

		this.latestUpdateTime = Date.now() - startResolve

		// Redraw the timeline.
		this.redrawTimeline()

		this.latestUpdateTime = Date.now() - startResolve
	}

	/**
	 * Sets the viewport to a position, zoom, and playback speed.
	 * Playback speed currently not implemented.
	 * @param viewPort Object to update viewport with.
	 */
	public setViewPort (viewPort: ViewPort) {
		// Whether the viewport has changed.
		let changed = false

		// If zoom has been specified.
		if (viewPort.zoom !== undefined) {
			// Zoom to specified zoom.
			this._timelineZoom = viewPort.zoom

			changed = true
		}

		// If timestamp has been specified.
		if (viewPort.timestamp !== undefined) {
			// Set start time to specified time.
			if (viewPort.timestamp > 0) {
				this._viewStartTime = viewPort.timestamp
				changed = true
			}
		}

		if (viewPort.playViewPort !== undefined) {
			this._playViewPort = viewPort.playViewPort
		}

		// If the playback speed has been set, set the new playback speed.
		if (viewPort.playSpeed !== undefined) {
			if (!this._drawPlayhead) throw new Error('setViewPort: viewPort.playSpeed was set, but drawPlayhead was not set in constructor')
			this._playSpeed = viewPort.playSpeed
		}

		// Set playhead playing/ not playing.
		if (viewPort.playPlayhead !== undefined) {
			if (!this._drawPlayhead) throw new Error('setViewPort: viewPort.playPlayhead was set, but drawPlayhead was not set in constructor')
			this._playHeadPlaying = viewPort.playPlayhead
		}

		if (viewPort.playheadTime !== undefined) {
			if (!this._drawPlayhead) throw new Error('setViewPort: viewPort.playheadTime was set, but drawPlayhead was not set in constructor')
			this._playHeadTime = Math.max(0, viewPort.playheadTime)

			if (this._playHeadTime > 0) this._updateDrawLastTime = this._playHeadTime
			changed = true
		}

		// Redraw timeline if anything has changed.
		if (changed === true) {

			this.redrawTimeline()
		}
	}

	/**
	 * Accessor for polling the currently hovered over object.
	 */
	public getHoveredObject () {
		return this._hoveredOver
	}

	/**
	 * Calculates the height to give to each row to fit all layers on screen.
	 * @param {String[]} layers Map of layers to use.
	 * @returns Height of rows.
	 */
	private calculateRowHeight (layers: Layers): number {
		return Math.min(MAX_LAYER_HEIGHT, this._timelineHeight / Object.keys(layers).length)
	}

	private updateLayerLabels () {
		// Store layers to draw.
		const o = this.getLayersToDraw()

		if (!isEqual(this._layerLabels, o.layers)) {
			this._layerLabels = o.layers

			// Calculate row height.
			this._rowHeight = this.calculateRowHeight(this._layerLabels)

			// Set timeline object height.
			this._timelineObjectHeight = this._rowHeight * TIMELINE_OBJECT_HEIGHT

			this._numberOfLayers = Object.keys(this._layerLabels).length
			this._rowsTotalHeight = this._rowHeight * this._numberOfLayers
		}
	}

	/**
	 * Draws the layer labels to the canvas.
	 */
	private drawLayerLabels () {
		let row = 0
		// Iterate through layers.
		for (let layerName of Object.keys(this._layerLabels)) {

			this._canvas.fillStyle = COLOR_LABEL_BACKGROUND
			this._canvas.fillRect(0, this._timelineTop + (row * this._rowHeight), this._layerLabelWidth, this._rowHeight)

			this._canvas.fillStyle = TEXT_COLOR
			this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY
			this._canvas.textBaseline = 'middle'
			this._canvas.textAlign = 'left'
			this._canvas.fillText(layerName, 0, this._timelineTop + (row * this._rowHeight) + (this._rowHeight / 2), this._layerLabelWidth)

			if (this._layerLabels[layerName] !== 0) {
				this._canvas.fillStyle = COLOR_LINE
				this._canvas.fillRect(this._layerLabelWidth, this._timelineTop + (row * this._rowHeight), this._viewDrawWidth, THICKNESS_LINE)
			}

			row++
		}
	}

	/**
	 * Draws the timeline background.
	 */
	private drawBackground () {
		this._canvas.fillStyle = COLOR_BACKGROUND
		this._canvas.fillRect(0, 0, this._canvasWidth, this._canvasHeight)
	}

	private drawTimeLabels() {
		this._canvas.fillStyle = COLOR_RULER_HEADER
		this._canvas.fillRect(0, 0, this._canvasWidth, RULER_HEADER_HEIGHT)

		this._canvas.fillStyle = TEXT_COLOR
		this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY
		this._canvas.textBaseline = 'middle'
		this._canvas.textAlign = 'right'
		this._canvas.fillText(Math.round(this._viewStartTime) + '', this._viewDrawX, RULER_HEADER_HEIGHT / 2)

		this.drawBackgroundRuler()
	}

	/**
	 * Draw a ruler on top of background
	 */
	private drawBackgroundRuler () {

		const range = this.viewRange
		const endTime = this.viewEndTime

		const circaNumberOfLines = 5
		const rounder = Math.pow(10, Math.floor(Math.log10(range / circaNumberOfLines))) // What to round the ruler to
		const rounderNext = rounder * 10

		const numberOfLines = Math.floor(range / rounder)

		const rulerDiff = rounder

		const startTime = Math.floor(this._viewStartTime / rounder) * rounder

		const opacity = (
			Math.min(1, circaNumberOfLines / numberOfLines)
		)
		if (rulerDiff) {
			this._canvas.strokeStyle = RULER_LINE_COLOR
			this._canvas.lineWidth = RULER_LINE_WIDTH
			this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY
			this._canvas.textBaseline = 'middle'
			this._canvas.textAlign = 'right'
			this._canvas.fillStyle = TEXT_COLOR
			for (let rulerTime = startTime; rulerTime < endTime; rulerTime += rulerDiff) {
				this._canvas.beginPath()
				let x = this.timeToXCoord(rulerTime)

				let distanceToNext = (rulerTime / rounderNext) % 1
				if (distanceToNext > 0.5) distanceToNext -= 1
				distanceToNext = Math.abs(distanceToNext)

				if (distanceToNext < 0.01) {
					// Is a significant line
					this._canvas.globalAlpha = 1
				} else {
					this._canvas.globalAlpha = opacity
				}

				if (x >= this._viewDrawX) {
					const drawText = (x >= 50 && this._canvas.globalAlpha === 1)

					this._canvas.moveTo(x, 0)
					this._canvas.lineTo(x, this._canvasHeight)

					if (drawText) {
						this._canvas.fillText(rulerTime + '', x, RULER_HEADER_HEIGHT / 2)
					}
				}
				this._canvas.stroke()
			}
			this._canvas.globalAlpha = 1
		}
	}

	/**
	 * Draws the playhead initially.
	 */
	private drawPlayhead () {
		// If the playhead should be draw.
		if (this._drawPlayhead) {
			if (this.istimeInView(this._playHeadTime)) {
				this._canvas.fillStyle = COLOR_PLAYHEAD
				this._canvas.fillRect(this.timeToXCoord(this._playHeadTime), 0, THICKNESS_PLAYHEAD, this._canvasHeight)
			}
		}
	}

	/**
	 * Gets the layers to draw from the timeline.
	 */
	private getLayersToDraw () {
		this._hoveredObjectMap = {}
		const layersArray: string[] = this._resolvedStates ? Object.keys(this._resolvedStates.layers) : []

		layersArray.sort((a, b) => {
			if (a > b) return 1
			if (a < b) return 1
			return 0
		})

		const layers: Layers = {}

		layersArray.forEach((layerName, index) => {
			layers[layerName] = index
			this._hoveredObjectMap[layerName] = []
		})

		return {
			layers: layers,
			layersArray: layersArray
		}
	}

	/**
	 * Redraws the timeline to the canvas.
	 */
	private redrawTimeline () {
		this._canvas.clearRect(0, 0, this._canvasWidth, this._canvasHeight)
		this.drawBackground()
		this.drawTimeLabels()
		this.drawLayerLabels()

		// Recompute objects positions
		this._timelineState = this.getTimelineDrawState(this._resolvedStates)

		// Draw the current state.
		this.drawTimelineState(this._timelineState)

		this.drawPlayhead()

		this.checkAutomaticReresolve()
	}

	/**
	 * Draws a timeline state to the canvas.
	 * @param {TimelineDrawState} currentDrawState State to draw.
	 */
	private drawTimelineState (currentDrawState: TimelineDrawState) {
		for (let element in currentDrawState) {
			const drawState = currentDrawState[element]
			if (drawState.visible) {
				this._canvas.fillStyle = COLOR_TIMELINE_OBJECT_FILL
				this._canvas.fillRect(drawState.left, drawState.top, drawState.width, drawState.height)

				this._canvas.strokeStyle = COLOR_TIMELINE_OBJECT_BORDER
				this._canvas.lineWidth = THICKNESS_TIMELINE_OBJECT_BORDER
				this._canvas.strokeRect(drawState.left, drawState.top, drawState.width, drawState.height)

				this._canvas.fillStyle = TEXT_COLOR
				this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY
				this._canvas.textBaseline = 'top'
				this._canvas.fillText(drawState.title, drawState.left, drawState.top)
			}
		}
	}

	/**
	 * Returns the draw states for all timeline objects.
	 * @param {ResolvedStates} timeline Timeline to draw.
	 * @returns {TimelineDrawState} State of time-based objects.
	 */
	private getTimelineDrawState (timeline: ResolvedStates | undefined): TimelineDrawState {
		let currentDrawState: TimelineDrawState = {}
		if (timeline) {
			for (let objId in timeline.objects) {
				let timelineObj = timeline.objects[objId]

				for (let _i = 0; _i < timelineObj.resolved.instances.length; _i++) {
					let instanceObj = timelineObj.resolved.instances[_i]
					let name = 'timelineObject:' + objId + ':' + instanceObj.id

					currentDrawState[name] = this.createStateForObject(
						timelineObj,
						instanceObj.start,
						instanceObj.end
					)

					if (currentDrawState[name].visible === true) {
						if (!this._hoveredObjectMap[timelineObj.layer + '']) this._hoveredObjectMap[timelineObj.layer + ''] = []
						this._hoveredObjectMap[timelineObj.layer + ''].push({
							startX: currentDrawState[name].left,
							endX: currentDrawState[name].left + currentDrawState[name].width,
							objectRefId: objId,
							instanceId: instanceObj.id,
							type: 'timelineObject',
							name: name
						})
					}
				}
			}
		}

		return currentDrawState
	}

	/**
	 * Creates a draw state for a timeline object.
	 * @param {string} layer Object's layer.
	 * @param {number} start Start time.
	 * @param {number} end End time.
	 * @returns {DrawState} State of the object to draw.
	 */
	private createStateForObject (obj: ResolvedTimelineObject, start: number, end: number | null): DrawState {
		// Default state (hidden).
		let state: DrawState = {
			height: 0,
			left: 0,
			top: 0,
			width: 0,
			visible: false,
			title: 'N/A'
		}
		// State should be default if the object is not being shown.
		if (this.showOnTimeline(start, end)) {
			// Get object dimensions and position.
			let objectWidth = this.getObjectWidth(start, end)
			let xCoord = this.capXcoordToView(this.timeToXCoord(start))

			let objectTop = this.getObjectOffsetFromTop(obj.layer + '')

			// Set state properties.
			state.height = this._timelineObjectHeight
			state.left = xCoord
			state.top = objectTop
			state.width = objectWidth
			state.visible = true
			state.title = obj.id
		}

		return state
	}

	/**
	 * Calculates the offset, in pixels from the start of the timeline for an object.
	 * @param {number} start start time of the object.
	 * @returns {number} Offset in pixels.
	 */
	// private getObjectOffsetFromTimelineStart (start: number): number {
	// 	// Calculate offset.
	// 	let offset = (start - this._viewStartTime) * this.pixelsWidthPerUnitTime

	// 	// Offset cannot be to the left of the timeline start position.
	// 	if (offset < 0) {
	// 		offset = 0
	// 	}

	// 	return offset
	// }

	/**
	 * Calculates the width, in pixels, of an object based on its duration.
	 * @param {number} start Start time of the object.
	 * @param {number} end End time of the object.
	 * @returns {number} Width in pixels.
	 */
	private getObjectWidth (startTime: number, endTime: number | null): number {

		if (!endTime) return this._canvasWidth

		// If the start time is less than the timeline start, set to timeline start.
		if (startTime < this._viewStartTime) {
			startTime = this._viewStartTime
		}

		// Calculate duration of the object remaining on the timeline.
		let duration = endTime - startTime

		// Return end point position in pixels.
		return duration * this.pixelsWidthPerUnitTime
	}

	/**
	 * Determines whether to show an object on the timeline.
	 * @param {number} start Object start time.
	 * @param {number} end Object end time.
	 * @returns {true} if object should be shown on the timeline.
	 */
	private showOnTimeline (start: number, end: number | null) {
		let isAfter = start >= this.viewEndTime
		let isBefore = (end || Infinity) <= this._viewStartTime
		return !isAfter && !isBefore
	}

	/**
	 * Calculate position of object instance from top of timeline according to its layer.
	 * @param {string} layer Object's layer.
	 * @returns Position relative to top of canvas in pixels.
	 */
	private getObjectOffsetFromTop (layerName: string): number {
		let top = this._layerLabels[layerName]

		return this._timelineTop + (top * this._rowHeight)
	}

	/**
	 * Moves the playhead. Called periodically.
	 */
	private updateDraw () {
		const now = Date.now()
		// How long time since last update:
		const dt: number = (
			this._updateDrawLastTime > 0 ?
			now - this._updateDrawLastTime :
			1
		) / 1000

		this._updateDrawLastTime = now

		const deltaTime = this._playSpeed * dt

		// Check playhead should be drawn.

		let needRedraw: boolean = false

		if (this._playHeadPlaying && this._drawPlayhead) {
			if (
				this._playViewPort &&
				this.istimeInView(this._playHeadTime) // Only play if playhead is in view
			) {
				this._viewStartTime += deltaTime
			}

			// Move playhead forward
			this._playHeadTime += deltaTime
			needRedraw = true
		}

		if (needRedraw) {
			this.redrawTimeline()
		}
		// call this function on next frame
		window.requestAnimationFrame(() => this.updateDraw())
	}

	/**
	 * Handles mouse down event.
	 * @param event Mouse event.
	 */
	private canvasMouseDown (event) {
		// Store mouse is down.
		this._mouseDown = true

		// Store X position of mouse on click.
		this._mouseLastX = event.clientX

		// Prevent event.
		event.preventDefault()
		event.stopPropagation()
	}

	/**
	 * Handles mouse up event.
	 * @param event Mouse event.
	 */
	private canvasMouseUp (event) {
		// Mouse no longer down.
		this._mouseDown = false
		// Reset scroll direction.
		this._lastScrollDirection = 0

		// Prevent event.
		event.preventDefault()
		event.stopPropagation()
	}

	/**
	 * Handles mouse movement on canvas.
	 * @param event Mouse event.
	 */
	private canvasMouseMove (event) {
		// If mouse is down.
		if (this._mouseDown) {
			// If we are beginning scrolling, we can move freely.
			if (this._lastScrollDirection === undefined || this._lastScrollDirection === 0) {
				// Store current mouse X.
				this._mouseLastX = event.clientX

				// Calculate change in X.
				let deltaX = event.clientX - this._mouseLastX

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
					this._mouseLastX = event.clientX

					this._lastScrollDirection = -1
				} else if (direction > 0 && this._lastScrollDirection === -1) {
					this._mouseLastX = event.clientX

					this._lastScrollDirection = 1
				} else {
					// Calculate change in X.
					let deltaX = event.clientX - this._mouseLastX

					// Store last X position.
					this._mouseLastX = event.clientX

					// Move by change in X.
					this.canvasScrollByDeltaX(-deltaX)
				}
			}

			// Redraw timeline.
			this.redrawTimeline()
		} else {
			// Whether an object is under the cursor.
			let found = false

			// Find the object that is currently hovered over.
			let mousePos = this.getMousePos(this._canvasContainer, event)

			if (mousePos.x > this._viewDrawX) {
				if (mousePos.y > this._timelineTop && mousePos.y < this._rowsTotalHeight) {
					let selectedRow = Math.floor((mousePos.y / this._rowsTotalHeight) * this._numberOfLayers)

					let layer: string | undefined
					Object.keys(this._layerLabels).forEach(layerName => {
						if (this._layerLabels[layerName] === selectedRow) layer = layerName
					})
					let hoverMapData = (layer ? this._hoveredObjectMap[layer] : []) || []

					hoverMapData.forEach(object => {
						if (object.startX <= mousePos.x && object.endX >= mousePos.x) {
							found = true

							const hoverHash = object.type + object.objectRefId + object.instanceId // hash-ish
							if (
								this._lastHoveredHash !== hoverHash
							) {
								// Get object metadata from the object name of the hovered object.

								// If we are hovering over a timeline object.
								if (object.type === 'timelineObject') {
									// Get the timeline object and the instance being hovered over.
									if (this._resolvedStates) {
										let timelineObject = this._resolvedStates.objects[object.objectRefId]

										let instance = timelineObject.resolved.instances.find(instance => instance.id === object.instanceId)
										if (instance) {
											// Construct hover info.
											let hoverInfo: HoveredObject = {
												object: timelineObject,
												instance: instance,
												pointer: { xPostion: mousePos.x, yPosition: mousePos.y }
											}

											// Set currently hovered object.
											this._hoveredOver = hoverInfo

											// Emit event.
											this.emit('timeline:hover', { detail: this._hoveredOver })

										}
										// Store last items.
										this._lastHoverAction = MOUSEIN
										this._lastHoveredHash = hoverHash
									}
								}
							}
						}
					})
				}
			}

			// Emit undefined when mouse out.
			if (!found && this._lastHoverAction === MOUSEIN) {
				this.emit('timeline:hover', { detail: undefined })
				this._lastHoverAction = MOUSEOUT
			}
		}
	}

	/**
	 * Handles scroll wheel events on the canvas.
	 * @param event Scroll event.
	 */
	private canvasScrollWheel (event) {
		// Get mouse pointer coordinates on canvas.
		let canvasCoord = this.getMousePos(this._canvasContainer, event)

		// Don't scroll if mouse is not over timeline.
		if (canvasCoord.x <= this._viewDrawX) {
			return
		}

		let changed = false

		// CTRL + scroll to zoom.
		if (event.ctrlKey === true) {
			if (event.deltaY) {
				changed = true
				const zoomFactor = Math.pow(ZOOM_FACTOR, -event.deltaY)
				this.zoomUnderCursor(canvasCoord.x, zoomFactor)
			}
		} else if (event.deltaX !== 0) { // Scroll on x-axis
			changed = true

			// Pan.
			this.canvasScrollByDeltaX((event.deltaX * (PAN_FACTOR * this.stepSize)))
		} else if (event.deltaY !== 0 && event.altKey === true) { // Also scroll on alt-key + scroll y-axis
			changed = true

			// Pan.
			this.canvasScrollByDeltaX((event.deltaY * (PAN_FACTOR * this.stepSize)))
		}

		// Prevent event.
		event.preventDefault()
		event.stopPropagation()

		if (changed) {
			// Redraw timeline.
			this.redrawTimeline()
		}
	}

	/**
	 * Scroll across the canvas by a specified X value.
	 * @param {number} deltaX Value to move by.
	 */
	private canvasScrollByDeltaX (deltaX: number) {
		// Calculate new starting time.
		let targetStart = this._viewStartTime + (deltaX / this.pixelsWidthPerUnitTime)

		// Starting time cannot be < 0.
		if (targetStart < 0) {
			targetStart = 0
		}

		// Optimisation, don't redraw if nothing has changed.
		if (targetStart === this._viewStartTime) {
			return
		}
		this._viewStartTime = targetStart
	}

	/**
	 * Zooms into/out of timeline, keeping the time under the cursor in the same position.
	 * @param cursorX Position of mouse cursor.
	 */
	private zoomUnderCursor (cursorX: number, zoomFactor: number) {

		// Point in time of the cursor
		let cursorTime = this.xCoordToTime(cursorX)

		// Ratio (in view range) of the cursor
		let cursorRatio = this.timeToRatio(cursorTime)

		// Change zoom:
		this._timelineZoom = this._timelineZoom * zoomFactor

		// Limit within current view
		cursorRatio = Math.max(0,
			Math.min(1,
				cursorRatio
			)
		)

		// Calculate start
		let targetStart = cursorTime - (cursorRatio * this.viewRange)

		// Start cannot be less than 0
		if (targetStart < 0) {
			targetStart = 0
		}

		// Set draw time
		this._viewStartTime = targetStart
	}
	/**
	 * Gets the mouse position relative to the top-left of the canvas [pixels]
	 * @param canvas
	 * @param evt
	 * @returns {x: number, y: number} Position.
	 */
	private getMousePos (canvas, evt) {
		const rect = canvas.getBoundingClientRect()
		return {
		  x: evt.clientX - rect.left,
		  y: evt.clientY - rect.top
		}
	}

	/**
	 * Trims a timeline so that objects only exist within a specified time period.
	 * @param timeline Timeline to trim.
	 * @param trim Times to trim between.
	 */
	private trimTimeline (timeline: ResolvedStates, trim: TrimProperties): ResolvedStates {
		// The new resolved objects.
		let newObjects: ResolvedTimelineObjects = {}

		// Iterate through resolved objects.
		Object.keys(timeline.objects).forEach((objId: string) => {
			const obj = timeline.objects[objId]
			const resultingInstances: TimelineObjectInstance[] = []
			obj.resolved.instances.forEach(instance => {
				// Whether to insert this object into the new timeline.
				let useInstance = false

				let newInstance: TimelineObjectInstance = Object.assign({}, instance) // clone

				// If trimming the start time.
				if (trim.start) {
					// If the object ends after the trim start time.
					if ((instance.end || Infinity) > trim.start) {
						useInstance = true
						if (newInstance.start < trim.start) {
							newInstance.start = trim.start
						}
					}
				}

				// If trimming the end time.
				if (trim.end) {
					// If the object starts before the trim end time.
					if (instance.start < trim.end) {
						useInstance = true
						if ((newInstance.end || Infinity) > trim.end) {
							newInstance.end = trim.end
						}
					}
				}
				if (!trim.start && !trim.end) {
					useInstance = true
				}

				if (
					useInstance &&
					newInstance.start < (newInstance.end || Infinity)
				) {
					resultingInstances.push(newInstance)
				}
			})
			// If there isn't a resolved object for the new instance, create it.
			if (!newObjects[objId]) {
				let newObject: ResolvedTimelineObject = {
					content: obj.content,
					enable: obj.enable,
					id: obj.id,
					layer: obj.layer,
					resolved: {
						instances: [],
						levelDeep: obj.resolved.levelDeep,
						resolved: obj.resolved.resolved,
						resolving: obj.resolved.resolving
					}
				}
				newObjects[objId] = newObject
			}
			newObjects[objId].resolved.instances = resultingInstances
		})

		return {
			classes:	timeline.classes,
			layers:		timeline.layers,
			objects:	newObjects,
			options:	timeline.options,
			statistics:	timeline.statistics,
			state:		timeline.state,
			nextEvents:	timeline.nextEvents
		}
	}

	/**
	 * Merges two timelines by merging instances of objects that intersect each other.
	 * @param past Older timeline.
	 * @param present Newer timeline.
	 * @returns {ResolvedTimeline} containing merged timelines.
	 */
	private mergeTimelineObjects (past: ResolvedStates, present: ResolvedStates, fromNewTimeline: boolean): ResolvedStates {
		const resultingObjects: ResolvedTimelineObjects = {}
		if (fromNewTimeline) {
			past = this.trimTimeline(
				past,
				{ end: this._playHeadTime }
			)
			present = this.trimTimeline(
				present,
				{ start: this._playHeadTime }
			)
			// Because we want to keep old objects, this iterator is used to create unique old ids for them
			this._mergeIterator++

			Object.keys(past.objects).forEach((objId: string) => {
				const pastObj = past.objects[objId]

				// @ts-ignore: hack to mark it as a "past object"
				if (pastObj.__pastObj) {
					// Copy over it right away, it's old. Don't do anything else
					resultingObjects[objId] = pastObj
					return
				}

				// If an object exists in both timelines
				const presentObj = present.objects[objId]
				if (presentObj) {
					if (
						// Compare the objects, only look into merging them if they look identical
						isEqual(
							Object.assign({}, pastObj, { resolved: null }),
							Object.assign({}, presentObj, { resolved: null }),
						)
					) {

						// This assumes that all past instances stop at a certain time at the very latest,
						// and that all new instances start at that time at the very earliest.

						// Iterate over all instances of those objects.
						const allInstances: {[endTime: string]: TimelineObjectInstance } = {}
						pastObj.resolved.instances.forEach(pastInstance => {
							allInstances[pastInstance.end + ''] = pastInstance
						})
						presentObj.resolved.instances.forEach(presentInstance => {
							if (allInstances[presentInstance.start + '']) {
								// The instances are next to each other, merge them into one:
								allInstances[presentInstance.start + ''].end = presentInstance.end
							} else {
								allInstances[presentInstance.start + ''] = presentInstance
							}
						})
						presentObj.resolved.instances = []
						Object.keys(allInstances).forEach(key => {
							const instance = allInstances[key]
							presentObj.resolved.instances.push(instance)
						})

						// Copy over the new object
						resultingObjects[objId] = presentObj

						return // don't copy over old object
					} else {
						// The objects doesn't look identical
						// Copy over the new object
						resultingObjects[objId] = presentObj
					}
				} else {
					// The old object doesn't exist in the new timeline
				}

				// @ts-ignore: hack to mark it as a "past object"
				pastObj.__pastObj = true
				// Copy over the old object
				resultingObjects[this._mergeIterator + '__' + objId] = pastObj
			})
			// Iterate over the next objects
			Object.keys(present.objects).forEach((objId: string) => {
				const presentObj = present.objects[objId]

				if (!past.objects[objId]) { // (if it did existed in the past, it has already been handled)
					// Just copy over the new object
					resultingObjects[objId] = presentObj
				}
			})
		} else {
			// No new timeline, objects and instances are only added

			Object.keys(past.objects).forEach((objId: string) => {
				const pastObj = past.objects[objId]
				resultingObjects[objId] = pastObj
			})

			Object.keys(present.objects).forEach((objId: string) => {
				const presentObj = present.objects[objId]

				const existingObj = resultingObjects[objId]
				if (existingObj) {
					// merge with old instances
					const existingInstances: {[key: string]: true} = {}

					existingObj.resolved.instances.forEach(instance => {
						existingInstances[instance.start + '_' + instance.end] = true
					})
					presentObj.resolved.instances.forEach(instance => {
						// Only push instances that aren't already present:
						if (!existingInstances[instance.start + '_' + instance.end]) {
							existingObj.resolved.instances.push(instance)
						}
					})
				} else {
					resultingObjects[objId] = presentObj
				}
			})
		}

		const resultingLayers: ResolvedStates['layers'] = {}
		Object.keys(resultingObjects).forEach(key => {
			const obj = resultingObjects[key]
			const layer = obj.layer + ''
			if (!resultingLayers[layer]) resultingLayers[layer] = []

			resultingLayers[layer].push(key)

		})

		return {
			...present,
			objects: resultingObjects,
			layers: resultingLayers
		}
	}

	private updateTimelineResolveWindow () {
		const { start, end } = this.getExpandedStartEndTime(1)

		this._timelineResolveStart	= start
		this._timelineResolveEnd	= end

		this._timelineResolveZoom = this._timelineZoom

		if (this.latestUpdateTime) {
			// Calculate an optimal number of objects to create, so that the drawing still runs smoothly.

			const targetResolveTime = 50 // ms

			let ratio = targetResolveTime / this.latestUpdateTime

			this._timelineResolveCountAdjust = Math.max(0.1, Math.min(10,
				(1 + (this._timelineResolveCountAdjust * ratio)) / 2
			))
		}
	}
	private getExpandedStartEndTime (multiplier: number = 1) {
		let start = this._viewStartTime
		let end = this.viewEndTime

		let duration = end - start

		let expand = duration * (this._timelineResolveExpand - 1) * multiplier

		start	-= expand * 0.33
		end		+= expand * 0.66 // expand more into the future

		start	= Math.max(0, start)
		end		= Math.max(0, end)

		const zoomDiff = Math.max(this._timelineResolveZoom, this._timelineZoom) /
			Math.min(this._timelineResolveZoom, this._timelineZoom)

		return { start, end, zoomDiff }
	}
	private checkAutomaticReresolve () {

		const { start, end, zoomDiff } = this.getExpandedStartEndTime(0.2)

		if (
			this._timelineResolveAuto && (
				start	< this._timelineResolveStart ||
				end		> this._timelineResolveEnd ||
				zoomDiff > 3
			)
		) {
			if (!this.reresolveTimeout) {
				this.reresolveTimeout = setTimeout(() => {
					this.reresolveTimeout = null
					this.updateTimelineResolveWindow()
					this._updateTimeline()
				}, Math.max(100, this.latestUpdateTime * 5))
			}
		}
	}
	// --------------------- Conversions between position & time -------------
	/**
	 * Calculate the X coordinate of a time value.
	 * @param {number} time The time to convert.
	 * @returns {number} The X coordinate of the time.
	 */
	private timeToXCoord (time: number): number {
		return this._viewDrawX + (
			(time - this._viewStartTime) * this.pixelsWidthPerUnitTime
		)
	}
	/**
	 * Calculate the time of a X coordinate.
	 * @param {number} time The X coordinate to convert.
	 * @returns {number} The time of the X coordinate.
	 */
	private xCoordToTime (position: number): number {
		return this._viewStartTime + (
			(position - this._viewDrawX) / this.pixelsWidthPerUnitTime
		)
	}
	/** Calculate the ratio of the time in current view (0 i beginning, 1 is end)  */
	private timeToRatio (time: number) {
		return (time - this._viewStartTime) / this.viewRange
	}
	/** Returns true if the position is within the current view  */
	private istimeInView (time: number) {
		const ratio = this.timeToRatio(time)
		return ratio >= 0 && ratio < 1
	}
	private capXcoordToView (position: number) {
		return Math.max(this._viewDrawX,
			Math.min(this._viewDrawX + this._viewDrawWidth,
				position
			)
		)
	}
	// -------------- Getters / Convenience functions ---------------------
	/** Zoom factor [pixels / time] */
	private get pixelsWidthPerUnitTime () {
		return (this._timelineZoom / 100)
	}
	/** The range of the view [time] */
	private get viewRange () {
		return this._viewDrawWidth / this.pixelsWidthPerUnitTime
	}
	/** The end time of the view [time] */
	private get viewEndTime () {
		return this._viewStartTime + this.viewRange
	}
}
