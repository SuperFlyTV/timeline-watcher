(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.TimelineVisualizer = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("./lib/timelineVisualizer"), exports);

},{"./lib/timelineVisualizer":2,"tslib":33}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineVisualizer = void 0;
const isEqual = require("lodash.isequal");
const superfly_timeline_1 = require("superfly-timeline");
const events_1 = require("events");
/** Step size/ time step. */
const DEFAULT_STEP_SIZE = 1;
/** Width of label column. */
const LABEL_WIDTH_OF_TIMELINE = 0.25;
/** Default zoom */
const DEFAULT_ZOOM_VALUE = 100;
/** Factor to zoom by */
const ZOOM_FACTOR = 1.001;
/** Factor to pan by (pan = PAN_FACTOR * STEP_SIZE) */
const PAN_FACTOR = 10;
/** Maximum layer height */
const MAX_LAYER_HEIGHT = 60;
/** Amount to move playhead per second. */
const DEFAULT_PLAYHEAD_SPEED = 1;
/** BEGIN STYLING VALUES */
/** Timeline background color. */
const COLOR_BACKGROUND = '#333333';
/** Layer label background color. */
const COLOR_LABEL_BACKGROUND = '#666666';
/** Color of the ruler lines */
const RULER_LINE_COLOR = '#999999';
/** Width of the ruler lines */
const RULER_LINE_WIDTH = 1;
/** Playhead color. */
const COLOR_PLAYHEAD = 'rgba(255, 0, 0, 0.5)';
/** Playhead thickness. */
const THICKNESS_PLAYHEAD = 5;
/** Color of line separating timeline rows. */
const COLOR_LINE = 'black';
/** Height of line separating rows. */
const THICKNESS_LINE = 1;
/** Text properties. */
const TEXT_FONT_FAMILY = 'Calibri';
const TEXT_FONT_SIZE = 16;
const TEXT_COLOR = 'white';
/** Timeline object properties. */
const COLOR_TIMELINE_OBJECT_FILL = 'rgb(22, 102, 247, 0.75)';
const COLOR_TIMELINE_OBJECT_BORDER = 'rgba(232, 240, 255, 0.85)';
const THICKNESS_TIMELINE_OBJECT_BORDER = 1;
/** Timeline object height as a proportion of the row height. */
const TIMELINE_OBJECT_HEIGHT = 1;
/** END STYLING VALUES */
/** BEGIN CONSTANTS FOR STATE MANAGEMENT */
const MOUSEIN = 0;
const MOUSEOUT = 1;
class TimelineVisualizer extends events_1.EventEmitter {
    /**
     * @param {string} canvasId The ID of the canvas object to draw within.
     */
    constructor(canvasId, options = {}) {
        super();
        // Step size.
        this.stepSize = DEFAULT_STEP_SIZE;
        /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
        this._layerLabelWidthProportionOfCanvas = LABEL_WIDTH_OF_TIMELINE;
        /** Layers on timeline. */
        this._layerLabels = {};
        /** State of the timeline. */
        this._timelineState = {};
        /** Map of objects for determining hovered object */
        this._hoveredObjectMap = {};
        /** Start time of the current view. Defines the objects within view on the timeline [time] */
        this._viewStartTime = 0;
        /** Range of the current view [time] */
        // private _viewTimeRange: number = 1
        // private _drawTimeEnd: number
        /** Store whether the mouse is held down, for scrolling. */
        this._mouseDown = false;
        /** Current zoom amount. */
        this._timelineZoom = DEFAULT_ZOOM_VALUE;
        /** Whether or not the playhead should move. */
        this._playHeadPlaying = false;
        /** Speed of the playhead [units / second] */
        this._playSpeed = DEFAULT_PLAYHEAD_SPEED;
        /** The current time position of the playhead. */
        this._playHeadTime = 0;
        /** The last time updateDraw() did a draw. */
        this._updateDrawLastTime = 0;
        /** Whether the mouse last moved over an object or out. */
        this._lastHoverAction = MOUSEOUT;
        /** Name of object that was last hovered over. */
        this._lastHoveredHash = '';
        /** If the visualizer automatically should re-resolve the timeline when navigating the viewport */
        this._timelineResolveAuto = false;
        /** At what time the timeline was resolved [time] */
        this._timelineResolveStart = 0;
        this._timelineResolveEnd = 0;
        this._timelineResolveZoom = 1;
        this._timelineResolveCount = 100;
        this._timelineResolveCountAdjust = 1;
        /** How much extra (outside the current viewport) the timeline should be resolved to [ratio] */
        this._timelineResolveExpand = 3;
        this.latestUpdateTime = 0;
        this.reresolveTimeout = null;
        this._mergeIterator = 0;
        // Initialise other values.
        this._canvasId = canvasId;
        this.initCanvas();
        this._drawPlayhead = !!options.drawPlayhead;
        // Calculate width of label column.
        this._layerLabelWidth = this._canvasWidth * this._layerLabelWidthProportionOfCanvas;
        // Calculate timeline width and start point.
        this._viewDrawX = this._layerLabelWidth;
        this._viewDrawWidth = this._canvasWidth - this._layerLabelWidth;
        // Draw background.
        this.drawBackground();
        // Draw playhead.
        this.drawPlayhead();
        this.updateDraw();
    }
    /**
     * Initialises the canvas and registers canvas events.
     */
    initCanvas() {
        // Create new canvas object.
        this._canvasContainer = document.getElementById(this._canvasId);
        if (!this._canvasContainer)
            throw new Error(`Canvas "${this._canvasId}" not found`);
        // Get rendering context.
        this._canvas = this._canvasContainer.getContext('2d');
        // Register canvas interaction event handlers.
        this._canvasContainer.addEventListener('mousedown', (event) => this.canvasMouseDown(event));
        this._canvasContainer.addEventListener('mouseup', (event) => this.canvasMouseUp(event));
        this._canvasContainer.addEventListener('mousemove', (event) => this.canvasMouseMove(event));
        this._canvasContainer.addEventListener('wheel', (event) => this.canvasScrollWheel(event));
        // Get width and height of canvas.
        this._canvasWidth = this._canvasContainer.width;
        this._canvasHeight = this._canvasContainer.height;
    }
    /**
     * Updates the timeline, should be called when actions are added/removed from a timeline
     * but the same timeline is being drawn.
     * @param {TimelineObject[]} timeline Timeline to draw.
     * @param {ResolveOptions} options Resolve options.
     */
    updateTimeline(timeline, options) {
        // If options have not been specified set time to 0.
        if (options === undefined) {
            options = {
                time: 0,
                limitCount: 10
            };
        }
        this.latestTimeline = timeline;
        this.latestOptions = options;
        if (!options.limitTime) {
            this._timelineResolveAuto = true;
        }
        else {
            this._timelineResolveAuto = false;
        }
        const options2 = Object.assign({}, options);
        if (this._timelineResolveAuto) {
            this.updateTimelineResolveWindow();
        }
        if (this._resolvedTimeline === undefined) { // If first time this runs
            // Set timeline start and end times.
            if (options2.time !== undefined) {
                this._viewStartTime = options2.time;
            }
            // Move playhead to start time.
            this._playHeadTime = this._viewStartTime;
        }
        this._updateTimeline(true);
    }
    _updateTimeline(fromNewTimeline = false) {
        const options2 = Object.assign({}, this.latestOptions);
        if (this._timelineResolveAuto) {
            options2.time = this._timelineResolveStart;
            options2.limitTime = this._timelineResolveEnd;
            options2.limitCount = Math.ceil(this._timelineResolveCount * this._timelineResolveCountAdjust);
        }
        // If the playhead is being drawn, the resolve time should be at the playhead time.
        if (this._drawPlayhead && this._playHeadTime > options2.time) {
            options2.time = this._playHeadTime;
        }
        // Resolve the timeline.
        const startResolve = Date.now();
        const resolvedTimeline = (0, superfly_timeline_1.resolveTimeline)(this.latestTimeline, options2);
        if (this._resolvedTimeline === undefined) { // If first time this runs
            this._resolvedTimeline = resolvedTimeline;
        }
        else {
            if (this._drawPlayhead) {
                // Trim the current timeline:
                if (resolvedTimeline) {
                    // Merge the timelines.
                    this._resolvedTimeline = this.mergeTimelineObjects(this._resolvedTimeline, resolvedTimeline, fromNewTimeline);
                }
            }
            else {
                // Otherwise we only see one timeline at a time.
                // Overwrite the previous timeline:
                this._resolvedTimeline = resolvedTimeline;
            }
        }
        // Update layers.
        this.updateLayerLabels();
        this.latestUpdateTime = Date.now() - startResolve;
        // Redraw the timeline.
        this.redrawTimeline();
        this.latestUpdateTime = Date.now() - startResolve;
    }
    /**
     * Sets the viewport to a position, zoom, and playback speed.
     * Playback speed currently not implemented.
     * @param viewPort Object to update viewport with.
     */
    setViewPort(viewPort) {
        // Whether the viewport has changed.
        let changed = false;
        // If zoom has been specified.
        if (viewPort.zoom !== undefined) {
            // Zoom to specified zoom.
            this._timelineZoom = viewPort.zoom;
            changed = true;
        }
        // If timestamp has been specified.
        if (viewPort.timestamp !== undefined) {
            // Set start time to specified time.
            if (viewPort.timestamp > 0) {
                this._viewStartTime = viewPort.timestamp;
                changed = true;
            }
        }
        if (viewPort.playViewPort !== undefined) {
            this._playViewPort = viewPort.playViewPort;
        }
        // If the playback speed has been set, set the new playback speed.
        if (viewPort.playSpeed !== undefined) {
            if (!this._drawPlayhead)
                throw new Error('setViewPort: viewPort.playSpeed was set, but drawPlayhead was not set in constructor');
            this._playSpeed = viewPort.playSpeed;
        }
        // Set playhead playing/ not playing.
        if (viewPort.playPlayhead !== undefined) {
            if (!this._drawPlayhead)
                throw new Error('setViewPort: viewPort.playPlayhead was set, but drawPlayhead was not set in constructor');
            this._playHeadPlaying = viewPort.playPlayhead;
        }
        if (viewPort.playheadTime !== undefined) {
            if (!this._drawPlayhead)
                throw new Error('setViewPort: viewPort.playheadTime was set, but drawPlayhead was not set in constructor');
            this._playHeadTime = Math.max(0, viewPort.playheadTime);
            if (this._playHeadTime > 0)
                this._updateDrawLastTime = this._playHeadTime;
            changed = true;
        }
        // Redraw timeline if anything has changed.
        if (changed === true) {
            this.redrawTimeline();
        }
    }
    /**
     * Accessor for polling the currently hovered over object.
     */
    getHoveredObject() {
        return this._hoveredOver;
    }
    /**
     * Calculates the height to give to each row to fit all layers on screen.
     * @param {String[]} layers Map of layers to use.
     * @returns Height of rows.
     */
    calculateRowHeight(layers) {
        return Math.min(MAX_LAYER_HEIGHT, this._canvasHeight / Object.keys(layers).length);
    }
    updateLayerLabels() {
        // Store layers to draw.
        const o = this.getLayersToDraw();
        if (!isEqual(this._layerLabels, o.layers)) {
            this._layerLabels = o.layers;
            // Calculate row height.
            this._rowHeight = this.calculateRowHeight(this._layerLabels);
            // Set timeline object height.
            this._timelineObjectHeight = this._rowHeight * TIMELINE_OBJECT_HEIGHT;
            this._numberOfLayers = Object.keys(this._layerLabels).length;
            this._rowsTotalHeight = this._rowHeight * this._numberOfLayers;
        }
    }
    getLayers() {
        const layers = Object.keys(this._layerLabels);
        layers.sort((a, b) => a.localeCompare(b));
        return layers;
    }
    /**
     * Draws the layer labels to the canvas.
     */
    drawLayerLabels() {
        let row = 0;
        // Iterate through layers.
        for (let layerName of this.getLayers()) {
            this._canvas.fillStyle = COLOR_LABEL_BACKGROUND;
            this._canvas.fillRect(0, row * this._rowHeight, this._layerLabelWidth, this._rowHeight);
            this._canvas.fillStyle = TEXT_COLOR;
            this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY;
            this._canvas.textBaseline = 'middle';
            this._canvas.fillText(layerName, 0, (row * this._rowHeight) + (this._rowHeight / 2), this._layerLabelWidth);
            if (this._layerLabels[layerName] !== 0) {
                this._canvas.fillStyle = COLOR_LINE;
                this._canvas.fillRect(this._layerLabelWidth, row * this._rowHeight, this._viewDrawWidth, THICKNESS_LINE);
            }
            row++;
        }
    }
    /**
     * Draws the timeline background.
     */
    drawBackground() {
        this._canvas.fillStyle = COLOR_BACKGROUND;
        this._canvas.fillRect(0, 0, this._canvasWidth, this._canvasHeight);
        this.drawBackgroundRuler();
    }
    /**
     * Draw a ruler on top of background
     */
    drawBackgroundRuler() {
        const range = this.viewRange;
        const endTime = this.viewEndTime;
        const circaNumberOfLines = 5;
        const rounder = Math.pow(10, Math.floor(Math.log10(range / circaNumberOfLines))); // What to round the ruler to
        const rounderNext = rounder * 10;
        const numberOfLines = Math.floor(range / rounder);
        const rulerDiff = rounder;
        const startTime = Math.floor(this._viewStartTime / rounder) * rounder;
        const opacity = (Math.min(1, circaNumberOfLines / numberOfLines));
        if (rulerDiff) {
            this._canvas.strokeStyle = RULER_LINE_COLOR;
            this._canvas.lineWidth = RULER_LINE_WIDTH;
            for (let rulerTime = startTime; rulerTime < endTime; rulerTime += rulerDiff) {
                this._canvas.beginPath();
                let x = this.timeToXCoord(rulerTime);
                let distanceToNext = (rulerTime / rounderNext) % 1;
                if (distanceToNext > 0.5)
                    distanceToNext -= 1;
                distanceToNext = Math.abs(distanceToNext);
                if (distanceToNext < 0.01) {
                    // Is a significant line
                    this._canvas.globalAlpha = 1;
                }
                else {
                    this._canvas.globalAlpha = opacity;
                }
                if (x >= this._viewDrawX) {
                    this._canvas.moveTo(x, 0);
                    this._canvas.lineTo(x, this._canvasHeight);
                }
                this._canvas.stroke();
            }
            this._canvas.globalAlpha = 1;
        }
    }
    /**
     * Draws the playhead initially.
     */
    drawPlayhead() {
        // If the playhead should be draw.
        if (this._drawPlayhead) {
            if (this.istimeInView(this._playHeadTime)) {
                this._canvas.fillStyle = COLOR_PLAYHEAD;
                this._canvas.fillRect(this.timeToXCoord(this._playHeadTime), 0, THICKNESS_PLAYHEAD, this._canvasHeight);
            }
        }
    }
    /**
     * Gets the layers to draw from the timeline.
     */
    getLayersToDraw() {
        this._hoveredObjectMap = {};
        const layersArray = this._resolvedTimeline ? Object.keys(this._resolvedTimeline.layers) : [];
        layersArray.sort((a, b) => {
            if (a > b)
                return 1;
            if (a < b)
                return 1;
            return 0;
        });
        const layers = {};
        layersArray.forEach((layerName, index) => {
            layers[layerName] = index;
            this._hoveredObjectMap[layerName] = [];
        });
        return {
            layers: layers,
            layersArray: layersArray
        };
    }
    /**
     * Redraws the timeline to the canvas.
     */
    redrawTimeline() {
        this._canvas.clearRect(0, 0, this._canvasWidth, this._canvasHeight);
        this.drawBackground();
        this.drawLayerLabels();
        // Recompute objects positions
        this._timelineState = this.getTimelineDrawState(this._resolvedTimeline);
        // Draw the current state.
        this.drawTimelineState(this._timelineState);
        this.drawPlayhead();
        this.checkAutomaticReresolve();
    }
    /**
     * Draws a timeline state to the canvas.
     * @param {TimelineDrawState} currentDrawState State to draw.
     */
    drawTimelineState(currentDrawState) {
        for (let element in currentDrawState) {
            const drawState = currentDrawState[element];
            if (drawState.visible) {
                this._canvas.fillStyle = COLOR_TIMELINE_OBJECT_FILL;
                this._canvas.fillRect(drawState.left, drawState.top, drawState.width, drawState.height);
                this._canvas.strokeStyle = COLOR_TIMELINE_OBJECT_BORDER;
                this._canvas.lineWidth = THICKNESS_TIMELINE_OBJECT_BORDER;
                this._canvas.strokeRect(drawState.left, drawState.top, drawState.width, drawState.height);
                this._canvas.fillStyle = TEXT_COLOR;
                this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY;
                this._canvas.textBaseline = 'top';
                this._canvas.fillText(drawState.title, drawState.left, drawState.top);
            }
        }
    }
    /**
     * Returns the draw states for all timeline objects.
     * @param {ResolvedTimeline} timeline Timeline to draw.
     * @returns {TimelineDrawState} State of time-based objects.
     */
    getTimelineDrawState(timeline) {
        let currentDrawState = {};
        if (timeline) {
            for (let objId in timeline.objects) {
                let timelineObj = timeline.objects[objId];
                for (let _i = 0; _i < timelineObj.resolved.instances.length; _i++) {
                    let instanceObj = timelineObj.resolved.instances[_i];
                    let name = 'timelineObject:' + objId + ':' + instanceObj.id;
                    currentDrawState[name] = this.createStateForObject(timelineObj, instanceObj.start, instanceObj.end);
                    if (currentDrawState[name].visible === true) {
                        if (!this._hoveredObjectMap[timelineObj.layer + ''])
                            this._hoveredObjectMap[timelineObj.layer + ''] = [];
                        this._hoveredObjectMap[timelineObj.layer + ''].push({
                            startX: currentDrawState[name].left,
                            endX: currentDrawState[name].left + currentDrawState[name].width,
                            objectRefId: objId,
                            instanceId: instanceObj.id,
                            type: 'timelineObject',
                            name: name
                        });
                    }
                }
            }
        }
        return currentDrawState;
    }
    /**
     * Creates a draw state for a timeline object.
     * @param {string} layer Object's layer.
     * @param {number} start Start time.
     * @param {number} end End time.
     * @returns {DrawState} State of the object to draw.
     */
    createStateForObject(obj, start, end) {
        // Default state (hidden).
        let state = {
            height: 0,
            left: 0,
            top: 0,
            width: 0,
            visible: false,
            title: 'N/A'
        };
        // State should be default if the object is not being shown.
        if (this.showOnTimeline(start, end)) {
            // Get object dimensions and position.
            let objectWidth = this.getObjectWidth(start, end);
            let xCoord = this.capXcoordToView(this.timeToXCoord(start));
            let objectTop = this.getObjectOffsetFromTop(obj.layer + '');
            // Set state properties.
            state.height = this._timelineObjectHeight;
            state.left = xCoord;
            state.top = objectTop;
            state.width = objectWidth;
            state.visible = true;
            state.title = obj.id;
        }
        return state;
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
    getObjectWidth(startTime, endTime) {
        if (!endTime)
            return this._canvasWidth;
        // If the start time is less than the timeline start, set to timeline start.
        if (startTime < this._viewStartTime) {
            startTime = this._viewStartTime;
        }
        // Calculate duration of the object remaining on the timeline.
        let duration = endTime - startTime;
        // Return end point position in pixels.
        return duration * this.pixelsWidthPerUnitTime;
    }
    /**
     * Determines whether to show an object on the timeline.
     * @param {number} start Object start time.
     * @param {number} end Object end time.
     * @returns {true} if object should be shown on the timeline.
     */
    showOnTimeline(start, end) {
        let isAfter = start >= this.viewEndTime;
        let isBefore = (end || Infinity) <= this._viewStartTime;
        return !isAfter && !isBefore;
    }
    /**
     * Calculate position of object instance from top of timeline according to its layer.
     * @param {string} layer Object's layer.
     * @returns Position relative to top of canvas in pixels.
     */
    getObjectOffsetFromTop(layerName) {
        let top = this._layerLabels[layerName];
        return top * this._rowHeight;
    }
    /**
     * Moves the playhead. Called periodically.
     */
    updateDraw() {
        const now = Date.now();
        // How long time since last update:
        const dt = (this._updateDrawLastTime > 0 ?
            now - this._updateDrawLastTime :
            1) / 1000;
        this._updateDrawLastTime = now;
        const deltaTime = this._playSpeed * dt;
        // Check playhead should be drawn.
        let needRedraw = false;
        if (this._playHeadPlaying && this._drawPlayhead) {
            if (this._playViewPort &&
                this.istimeInView(this._playHeadTime) // Only play if playhead is in view
            ) {
                this._viewStartTime += deltaTime;
            }
            // Move playhead forward
            this._playHeadTime += deltaTime;
            needRedraw = true;
        }
        if (needRedraw) {
            this.redrawTimeline();
        }
        // call this function on next frame
        window.requestAnimationFrame(() => this.updateDraw());
    }
    /**
     * Handles mouse down event.
     * @param event Mouse event.
     */
    canvasMouseDown(event) {
        // Store mouse is down.
        this._mouseDown = true;
        // Store X position of mouse on click.
        this._mouseLastX = event.clientX;
        // Prevent event.
        event.preventDefault();
        event.stopPropagation();
    }
    /**
     * Handles mouse up event.
     * @param event Mouse event.
     */
    canvasMouseUp(event) {
        // Mouse no longer down.
        this._mouseDown = false;
        // Reset scroll direction.
        this._lastScrollDirection = 0;
        // Prevent event.
        event.preventDefault();
        event.stopPropagation();
    }
    /**
     * Handles mouse movement on canvas.
     * @param event Mouse event.
     */
    canvasMouseMove(event) {
        // If mouse is down.
        if (this._mouseDown) {
            // If we are beginning scrolling, we can move freely.
            if (this._lastScrollDirection === undefined || this._lastScrollDirection === 0) {
                // Store current mouse X.
                this._mouseLastX = event.clientX;
                // Calculate change in X.
                let deltaX = event.clientX - this._mouseLastX;
                // Store scrolling direction.
                if (deltaX < 0) {
                    this._lastScrollDirection = -1;
                }
                else {
                    this._lastScrollDirection = 1;
                }
                // Scroll to new X position.
                this.canvasScrollByDeltaX(-deltaX);
            }
            else {
                // Calculate scroll direction.
                let direction = this._mouseLastX - event.clientX;
                // If changing direction, store new direction but don't scroll.
                if (direction < 0 && this._lastScrollDirection === 1) {
                    this._mouseLastX = event.clientX;
                    this._lastScrollDirection = -1;
                }
                else if (direction > 0 && this._lastScrollDirection === -1) {
                    this._mouseLastX = event.clientX;
                    this._lastScrollDirection = 1;
                }
                else {
                    // Calculate change in X.
                    let deltaX = event.clientX - this._mouseLastX;
                    // Store last X position.
                    this._mouseLastX = event.clientX;
                    // Move by change in X.
                    this.canvasScrollByDeltaX(-deltaX);
                }
            }
            // Redraw timeline.
            this.redrawTimeline();
        }
        else {
            // Whether an object is under the cursor.
            let found = false;
            // Find the object that is currently hovered over.
            let mousePos = this.getMousePos(this._canvasContainer, event);
            if (mousePos.x > this._viewDrawX) {
                if (mousePos.y < this._rowsTotalHeight) {
                    let selectedRow = Math.floor((mousePos.y / this._rowsTotalHeight) * this._numberOfLayers);
                    let layer;
                    Object.keys(this._layerLabels).forEach(layerName => {
                        if (this._layerLabels[layerName] === selectedRow)
                            layer = layerName;
                    });
                    let hoverMapData = (layer ? this._hoveredObjectMap[layer] : []) || [];
                    hoverMapData.forEach(object => {
                        if (object.startX <= mousePos.x && object.endX >= mousePos.x) {
                            found = true;
                            const hoverHash = object.type + object.objectRefId + object.instanceId; // hash-ish
                            if (this._lastHoveredHash !== hoverHash) {
                                // Get object metadata from the object name of the hovered object.
                                // If we are hovering over a timeline object.
                                if (object.type === 'timelineObject') {
                                    // Get the timeline object and the instance being hovered over.
                                    if (this._resolvedTimeline) {
                                        let timelineObject = this._resolvedTimeline.objects[object.objectRefId];
                                        let instance = timelineObject.resolved.instances.find(instance => instance.id === object.instanceId);
                                        if (instance) {
                                            // Construct hover info.
                                            let hoverInfo = {
                                                object: timelineObject,
                                                instance: instance,
                                                pointer: { xPostion: mousePos.x, yPosition: mousePos.y }
                                            };
                                            // Set currently hovered object.
                                            this._hoveredOver = hoverInfo;
                                            // Emit event.
                                            this.emit('timeline:hover', { detail: this._hoveredOver });
                                        }
                                        // Store last items.
                                        this._lastHoverAction = MOUSEIN;
                                        this._lastHoveredHash = hoverHash;
                                    }
                                }
                            }
                        }
                    });
                }
            }
            // Emit undefined when mouse out.
            if (!found && this._lastHoverAction === MOUSEIN) {
                this.emit('timeline:hover', { detail: undefined });
                this._lastHoverAction = MOUSEOUT;
            }
        }
    }
    /**
     * Handles scroll wheel events on the canvas.
     * @param event Scroll event.
     */
    canvasScrollWheel(event) {
        // Get mouse pointer coordinates on canvas.
        let canvasCoord = this.getMousePos(this._canvasContainer, event);
        // Don't scroll if mouse is not over timeline.
        if (canvasCoord.x <= this._viewDrawX) {
            return;
        }
        let changed = false;
        // CTRL + scroll to zoom.
        if (event.ctrlKey === true) {
            if (event.deltaY) {
                changed = true;
                const zoomFactor = Math.pow(ZOOM_FACTOR, -event.deltaY);
                this.zoomUnderCursor(canvasCoord.x, zoomFactor);
            }
        }
        else if (event.deltaX !== 0) { // Scroll on x-axis
            changed = true;
            // Pan.
            this.canvasScrollByDeltaX((event.deltaX * (PAN_FACTOR * this.stepSize)));
        }
        else if (event.deltaY !== 0 && event.altKey === true) { // Also scroll on alt-key + scroll y-axis
            changed = true;
            // Pan.
            this.canvasScrollByDeltaX((event.deltaY * (PAN_FACTOR * this.stepSize)));
        }
        // Prevent event.
        event.preventDefault();
        event.stopPropagation();
        if (changed) {
            // Redraw timeline.
            this.redrawTimeline();
        }
    }
    /**
     * Scroll across the canvas by a specified X value.
     * @param {number} deltaX Value to move by.
     */
    canvasScrollByDeltaX(deltaX) {
        // Calculate new starting time.
        let targetStart = this._viewStartTime + (deltaX / this.pixelsWidthPerUnitTime);
        // Starting time cannot be < 0.
        if (targetStart < 0) {
            targetStart = 0;
        }
        // Optimisation, don't redraw if nothing has changed.
        if (targetStart === this._viewStartTime) {
            return;
        }
        this._viewStartTime = targetStart;
    }
    /**
     * Zooms into/out of timeline, keeping the time under the cursor in the same position.
     * @param cursorX Position of mouse cursor.
     */
    zoomUnderCursor(cursorX, zoomFactor) {
        // Point in time of the cursor
        let cursorTime = this.xCoordToTime(cursorX);
        // Ratio (in view range) of the cursor
        let cursorRatio = this.timeToRatio(cursorTime);
        // Change zoom:
        this._timelineZoom = this._timelineZoom * zoomFactor;
        // Limit within current view
        cursorRatio = Math.max(0, Math.min(1, cursorRatio));
        // Calculate start
        let targetStart = cursorTime - (cursorRatio * this.viewRange);
        // Start cannot be less than 0
        if (targetStart < 0) {
            targetStart = 0;
        }
        // Set draw time
        this._viewStartTime = targetStart;
    }
    /**
     * Gets the mouse position relative to the top-left of the canvas [pixels]
     * @param canvas
     * @param evt
     * @returns {x: number, y: number} Position.
     */
    getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }
    /**
     * Trims a timeline so that objects only exist within a specified time period.
     * @param timeline Timeline to trim.
     * @param trim Times to trim between.
     */
    trimTimeline(timeline, trim) {
        // The new resolved objects.
        let newObjects = {};
        // Iterate through resolved objects.
        Object.keys(timeline.objects).forEach((objId) => {
            const obj = timeline.objects[objId];
            const resultingInstances = [];
            obj.resolved.instances.forEach(instance => {
                // Whether to insert this object into the new timeline.
                let useInstance = false;
                let newInstance = Object.assign({}, instance); // clone
                // If trimming the start time.
                if (trim.start) {
                    // If the object ends after the trim start time.
                    if ((instance.end || Infinity) > trim.start) {
                        useInstance = true;
                        if (newInstance.start < trim.start) {
                            newInstance.start = trim.start;
                        }
                    }
                }
                // If trimming the end time.
                if (trim.end) {
                    // If the object starts before the trim end time.
                    if (instance.start < trim.end) {
                        useInstance = true;
                        if ((newInstance.end || Infinity) > trim.end) {
                            newInstance.end = trim.end;
                        }
                    }
                }
                if (!trim.start && !trim.end) {
                    useInstance = true;
                }
                if (useInstance &&
                    newInstance.start < (newInstance.end || Infinity)) {
                    resultingInstances.push(newInstance);
                }
            });
            // If there isn't a resolved object for the new instance, create it.
            if (!newObjects[objId]) {
                let newObject = {
                    content: obj.content,
                    enable: obj.enable,
                    id: obj.id,
                    layer: obj.layer,
                    resolved: Object.assign(Object.assign({}, obj.resolved), { instances: [] })
                };
                newObjects[objId] = newObject;
            }
            newObjects[objId].resolved.instances = resultingInstances;
        });
        return {
            classes: timeline.classes,
            layers: timeline.layers,
            objects: newObjects,
            statistics: timeline.statistics,
            nextEvents: timeline.nextEvents
        };
    }
    /**
     * Merges two timelines by merging instances of objects that intersect each other.
     * @param past Older timeline.
     * @param present Newer timeline.
     * @returns {ResolvedTimeline} containing merged timelines.
     */
    mergeTimelineObjects(past, present, fromNewTimeline) {
        const resultingObjects = {};
        if (fromNewTimeline) {
            past = this.trimTimeline(past, { end: this._playHeadTime });
            present = this.trimTimeline(present, { start: this._playHeadTime });
            // Because we want to keep old objects, this iterator is used to create unique old ids for them
            this._mergeIterator++;
            Object.keys(past.objects).forEach((objId) => {
                const pastObj = past.objects[objId];
                // @ts-ignore: hack to mark it as a "past object"
                if (pastObj.__pastObj) {
                    // Copy over it right away, it's old. Don't do anything else
                    resultingObjects[objId] = pastObj;
                    return;
                }
                // If an object exists in both timelines
                const presentObj = present.objects[objId];
                if (presentObj) {
                    if (
                    // Compare the objects, only look into merging them if they look identical
                    isEqual(Object.assign({}, pastObj, { resolved: null }), Object.assign({}, presentObj, { resolved: null }))) {
                        // This assumes that all past instances stop at a certain time at the very latest,
                        // and that all new instances start at that time at the very earliest.
                        // Iterate over all instances of those objects.
                        const allInstances = {};
                        pastObj.resolved.instances.forEach(pastInstance => {
                            allInstances[pastInstance.end + ''] = pastInstance;
                        });
                        presentObj.resolved.instances.forEach(presentInstance => {
                            if (allInstances[presentInstance.start + '']) {
                                // The instances are next to each other, merge them into one:
                                allInstances[presentInstance.start + ''].end = presentInstance.end;
                            }
                            else {
                                allInstances[presentInstance.start + ''] = presentInstance;
                            }
                        });
                        presentObj.resolved.instances = [];
                        Object.keys(allInstances).forEach(key => {
                            const instance = allInstances[key];
                            presentObj.resolved.instances.push(instance);
                        });
                        // Copy over the new object
                        resultingObjects[objId] = presentObj;
                        return; // don't copy over old object
                    }
                    else {
                        // The objects doesn't look identical
                        // Copy over the new object
                        resultingObjects[objId] = presentObj;
                    }
                }
                else {
                    // The old object doesn't exist in the new timeline
                }
                // @ts-ignore: hack to mark it as a "past object"
                pastObj.__pastObj = true;
                // Copy over the old object
                resultingObjects[this._mergeIterator + '__' + objId] = pastObj;
            });
            // Iterate over the next objects
            Object.keys(present.objects).forEach((objId) => {
                const presentObj = present.objects[objId];
                if (!past.objects[objId]) { // (if it did existed in the past, it has already been handled)
                    // Just copy over the new object
                    resultingObjects[objId] = presentObj;
                }
            });
        }
        else {
            // No new timeline, objects and instances are only added
            Object.keys(past.objects).forEach((objId) => {
                const pastObj = past.objects[objId];
                resultingObjects[objId] = pastObj;
            });
            Object.keys(present.objects).forEach((objId) => {
                const presentObj = present.objects[objId];
                const existingObj = resultingObjects[objId];
                if (existingObj) {
                    // merge with old instances
                    const existingInstances = {};
                    existingObj.resolved.instances.forEach(instance => {
                        existingInstances[instance.start + '_' + instance.end] = true;
                    });
                    presentObj.resolved.instances.forEach(instance => {
                        // Only push instances that aren't already present:
                        if (!existingInstances[instance.start + '_' + instance.end]) {
                            existingObj.resolved.instances.push(instance);
                        }
                    });
                }
                else {
                    resultingObjects[objId] = presentObj;
                }
            });
        }
        const resultingLayers = {};
        Object.keys(resultingObjects).forEach(key => {
            const obj = resultingObjects[key];
            const layer = obj.layer + '';
            if (!resultingLayers[layer])
                resultingLayers[layer] = [];
            resultingLayers[layer].push(key);
        });
        return Object.assign(Object.assign({}, present), { objects: resultingObjects, layers: resultingLayers });
    }
    updateTimelineResolveWindow() {
        const { start, end } = this.getExpandedStartEndTime(1);
        this._timelineResolveStart = start;
        this._timelineResolveEnd = end;
        this._timelineResolveZoom = this._timelineZoom;
        if (this.latestUpdateTime) {
            // Calculate an optimal number of objects to create, so that the drawing still runs smoothly.
            const targetResolveTime = 50; // ms
            let ratio = targetResolveTime / this.latestUpdateTime;
            this._timelineResolveCountAdjust = Math.max(0.1, Math.min(10, (1 + (this._timelineResolveCountAdjust * ratio)) / 2));
        }
    }
    getExpandedStartEndTime(multiplier = 1) {
        let start = this._viewStartTime;
        let end = this.viewEndTime;
        let duration = end - start;
        let expand = duration * (this._timelineResolveExpand - 1) * multiplier;
        start -= expand * 0.33;
        end += expand * 0.66; // expand more into the future
        start = Math.max(0, start);
        end = Math.max(0, end);
        const zoomDiff = Math.max(this._timelineResolveZoom, this._timelineZoom) /
            Math.min(this._timelineResolveZoom, this._timelineZoom);
        return { start, end, zoomDiff };
    }
    checkAutomaticReresolve() {
        const { start, end, zoomDiff } = this.getExpandedStartEndTime(0.2);
        if (this._timelineResolveAuto && (start < this._timelineResolveStart ||
            end > this._timelineResolveEnd ||
            zoomDiff > 3)) {
            if (!this.reresolveTimeout) {
                this.reresolveTimeout = setTimeout(() => {
                    this.reresolveTimeout = null;
                    this.updateTimelineResolveWindow();
                    this._updateTimeline();
                }, Math.max(100, this.latestUpdateTime * 5));
            }
        }
    }
    // --------------------- Conversions between position & time -------------
    /**
     * Calculate the X coordinate of a time value.
     * @param {number} time The time to convert.
     * @returns {number} The X coordinate of the time.
     */
    timeToXCoord(time) {
        return this._viewDrawX + ((time - this._viewStartTime) * this.pixelsWidthPerUnitTime);
    }
    /**
     * Calculate the time of a X coordinate.
     * @param {number} time The X coordinate to convert.
     * @returns {number} The time of the X coordinate.
     */
    xCoordToTime(position) {
        return this._viewStartTime + ((position - this._viewDrawX) / this.pixelsWidthPerUnitTime);
    }
    /** Calculate the ratio of the time in current view (0 i beginning, 1 is end)  */
    timeToRatio(time) {
        return (time - this._viewStartTime) / this.viewRange;
    }
    /** Returns true if the position is within the current view  */
    istimeInView(time) {
        const ratio = this.timeToRatio(time);
        return ratio >= 0 && ratio < 1;
    }
    capXcoordToView(position) {
        return Math.max(this._viewDrawX, Math.min(this._viewDrawX + this._viewDrawWidth, position));
    }
    // -------------- Getters / Convenience functions ---------------------
    /** Zoom factor [pixels / time] */
    get pixelsWidthPerUnitTime() {
        return (this._timelineZoom / 100);
    }
    /** The range of the view [time] */
    get viewRange() {
        return this._viewDrawWidth / this.pixelsWidthPerUnitTime;
    }
    /** The end time of the view [time] */
    get viewEndTime() {
        return this._viewStartTime + this.viewRange;
    }
}
exports.TimelineVisualizer = TimelineVisualizer;

},{"events":4,"lodash.isequal":5,"superfly-timeline":13}],3:[function(require,module,exports){

},{}],4:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],5:[function(require,module,exports){
(function (global){(function (){
/**
 * Lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright JS Foundation and other contributors <https://js.foundation/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    asyncTag = '[object AsyncFunction]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    nullTag = '[object Null]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    proxyTag = '[object Proxy]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    undefinedTag = '[object Undefined]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice,
    symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols,
    nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
    nativeKeys = overArg(Object.keys, Object);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView'),
    Map = getNative(root, 'Map'),
    Promise = getNative(root, 'Promise'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values == null ? 0 : values.length;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = objIsArr ? arrayTag : getTag(object),
      othTag = othIsArr ? arrayTag : getTag(other);

  objTag = objTag == argsTag ? objectTag : objTag;
  othTag = othTag == argsTag ? objectTag : othTag;

  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && isBuffer(object)) {
    if (!isBuffer(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
      : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var index = -1,
      result = true,
      seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, bitmask, customizer, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= COMPARE_UNORDERED_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      objProps = getAllKeys(object),
      objLength = objProps.length,
      othProps = getAllKeys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return arrayFilter(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable.call(object, symbol);
  });
};

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = baseGetTag(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

/**
 * Performs a deep comparison between two values to determine if they are
 * equivalent.
 *
 * **Note:** This method supports comparing arrays, array buffers, booleans,
 * date objects, error objects, maps, numbers, `Object` objects, regexes,
 * sets, strings, symbols, and typed arrays. `Object` objects are compared
 * by their own, not inherited, enumerable properties. Functions and DOM
 * nodes are compared by strict equality, i.e. `===`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.isEqual(object, other);
 * // => true
 *
 * object === other;
 * // => false
 */
function isEqual(value, other) {
  return baseIsEqual(value, other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = isEqual;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("./expression"), exports);
tslib_1.__exportStar(require("./resolvedTimeline"), exports);
tslib_1.__exportStar(require("./resolver"), exports);
tslib_1.__exportStar(require("./state"), exports);
tslib_1.__exportStar(require("./timeline"), exports);
tslib_1.__exportStar(require("./types"), exports);

},{"./expression":6,"./resolvedTimeline":8,"./resolver":9,"./state":10,"./timeline":11,"./types":12,"tslib":32}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventType = void 0;
var EventType;
(function (EventType) {
    EventType[EventType["START"] = 0] = "START";
    EventType[EventType["END"] = 1] = "END";
    EventType[EventType["KEYFRAME"] = 2] = "KEYFRAME";
})(EventType = exports.EventType || (exports.EventType = {}));

},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCloseCleanup = exports.validateExpression = exports.wrapInnerExpressions = exports.simplifyExpression = exports.interpretExpression = exports.applyKeyframeContent = exports.validateReferenceString = exports.validateKeyframe = exports.validateObject = exports.validateTimeline = exports.getResolvedState = exports.resolveTimeline = void 0;
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("./api"), exports);
const StateHandler_1 = require("./resolver/StateHandler");
const ExpressionHandler_1 = require("./resolver/ExpressionHandler");
const ResolverHandler_1 = require("./resolver/ResolverHandler");
const TimelineValidator_1 = require("./resolver/TimelineValidator");
/**
 * Resolves a timeline, i.e. resolves the references between objects
 * and calculates the absolute times for all objects in the timeline.
 */
function resolveTimeline(timeline, options) {
    const resolverInstance = new ResolverHandler_1.ResolverHandler(options);
    return resolverInstance.resolveTimeline(timeline);
}
exports.resolveTimeline = resolveTimeline;
/**
 * Retrieve the state for a certain point in time.
 * The state contains all objects that are active at that point in time.
 * @param resolvedTimeline
 * @param time
 * @param eventLimit
 */
function getResolvedState(resolvedTimeline, time, eventLimit = 0) {
    const stateHandler = new StateHandler_1.StateHandler();
    return stateHandler.getState(resolvedTimeline, time, eventLimit);
}
exports.getResolvedState = getResolvedState;
/**
 * Validates all objects in the timeline. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some optional strict rules. Set this to true to increase future compatibility.
 */
function validateTimeline(timeline, strict) {
    const validator = new TimelineValidator_1.TimelineValidator();
    validator.validateTimeline(timeline, strict);
}
exports.validateTimeline = validateTimeline;
/**
 * Validates a Timeline-object. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some optional strict rules. Set this to true to increase future compatibility.
 */
function validateObject(obj, strict) {
    const validator = new TimelineValidator_1.TimelineValidator();
    validator.validateObject(obj, strict);
}
exports.validateObject = validateObject;
/**
 * Validates a Timeline-keyframe. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some optional strict rules. Set this to true to increase future compatibility.
 */
function validateKeyframe(keyframe, strict) {
    const validator = new TimelineValidator_1.TimelineValidator();
    validator.validateKeyframe(keyframe, strict);
}
exports.validateKeyframe = validateKeyframe;
/**
 * Validates a string that is used in Timeline as a reference (an id, a class or layer)
 * @param str The string to validate
 * @param strict Set to true to enable some optional strict rules. Set this to true to increase future compatibility.
 */
function validateReferenceString(str, strict) {
    TimelineValidator_1.TimelineValidator.validateReferenceString(str, strict);
}
exports.validateReferenceString = validateReferenceString;
/**
 * Apply keyframe content onto its parent content.
 * The keyframe content is deeply-applied onto the parent content.
 * Note: This function mutates the parentContent.
 */
function applyKeyframeContent(parentContent, keyframeContent) {
    StateHandler_1.StateHandler.applyKeyframeContent(parentContent, keyframeContent);
}
exports.applyKeyframeContent = applyKeyframeContent;
let expressionHandler = undefined;
function getExpressionHandler() {
    if (!expressionHandler)
        expressionHandler = new ExpressionHandler_1.ExpressionHandler(true);
    return expressionHandler;
}
function interpretExpression(expression) {
    return getExpressionHandler().interpretExpression(expression);
}
exports.interpretExpression = interpretExpression;
function simplifyExpression(expr0) {
    return getExpressionHandler().simplifyExpression(expr0);
}
exports.simplifyExpression = simplifyExpression;
function wrapInnerExpressions(words) {
    return getExpressionHandler().wrapInnerExpressions(words);
}
exports.wrapInnerExpressions = wrapInnerExpressions;
function validateExpression(operatorList, expr0, breadcrumbs) {
    return getExpressionHandler().validateExpression(operatorList, expr0, breadcrumbs);
}
exports.validateExpression = validateExpression;
/**
 * If you have called any of the manual expression-functions, such as interpretExpression(),
 * you could call this to manually clean up an internal cache, to ensure your application quits cleanly.
 */
function onCloseCleanup() {
    if (expressionHandler)
        expressionHandler.clearCache();
}
exports.onCloseCleanup = onCloseCleanup;

},{"./api":7,"./resolver/ExpressionHandler":15,"./resolver/ResolverHandler":20,"./resolver/StateHandler":21,"./resolver/TimelineValidator":22,"tslib":32}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashTimelineObject = exports.CacheHandler = void 0;
const lib_1 = require("./lib/lib");
const performance_1 = require("./lib/performance");
const reference_1 = require("./lib/reference");
const timeline_1 = require("./lib/timeline");
class CacheHandler {
    constructor(cache, resolvedTimeline) {
        this.resolvedTimeline = resolvedTimeline;
        if (!cache.objHashes)
            cache.objHashes = {};
        if (!cache.objects)
            cache.objects = {};
        if (!cache.canBeUsed) {
            // Reset the cache:
            cache.objHashes = {};
            cache.objects = {};
            this.canUseIncomingCache = false;
        }
        else {
            this.canUseIncomingCache = true;
        }
        // cache.canBeUsed will be set in this.persistData()
        cache.canBeUsed = false;
        this.cache = cache;
    }
    debug(...args) {
        if (this.resolvedTimeline.options.debug)
            console.log(...args);
    }
    determineChangedObjects() {
        const toc = (0, performance_1.tic)('  cache.determineChangedObjects');
        // Go through all new objects, and determine whether they have changed:
        const allNewObjects = {};
        const changedReferences = {};
        const addChangedObject = (obj) => {
            const references = this.getAllReferencesThisObjectAffects(obj);
            for (const ref of references) {
                changedReferences[ref] = true;
            }
        };
        for (const obj of this.resolvedTimeline.objectsMap.values()) {
            const oldHash = this.cache.objHashes[obj.id];
            const newHash = hashTimelineObject(obj);
            allNewObjects[obj.id] = true;
            if (!oldHash)
                this.debug(`Cache: Object "${obj.id}" is new`);
            else if (oldHash !== newHash)
                this.debug(`Cache: Object "${obj.id}" has changed`);
            if (
            // Object is new:
            !oldHash ||
                // Object has changed:
                oldHash !== newHash) {
                this.cache.objHashes[obj.id] = newHash;
                addChangedObject(obj);
                const oldObj = this.cache.objects[obj.id];
                if (oldObj)
                    addChangedObject(oldObj);
            }
            else {
                // No timing-affecting changes detected
                /* istanbul ignore if */
                if (!oldHash)
                    this.debug(`Cache: Object "${obj.id}" is similar`);
                // Even though the timeline-properties hasn't changed,
                // the content (and other properties) might have:
                const oldObj = this.cache.objects[obj.id];
                /* istanbul ignore if */
                if (!oldObj) {
                    console.error('oldHash', oldHash);
                    console.error('ids', Object.keys(this.cache.objects));
                    throw new Error(`Internal Error: obj "${obj.id}" not found in cache, even though hashes match!`);
                }
                this.cache.objects[obj.id] = {
                    ...obj,
                    resolved: oldObj.resolved,
                };
            }
        }
        if (this.canUseIncomingCache) {
            // Go through all old hashes, removing the ones that doesn't exist anymore
            for (const objId in this.cache.objects) {
                if (!allNewObjects[objId]) {
                    const obj = this.cache.objects[objId];
                    delete this.cache.objHashes[objId];
                    addChangedObject(obj);
                }
            }
            // Invalidate objects, by gradually removing the invalidated ones from validObjects
            // Prepare validObjects:
            const validObjects = {};
            for (const obj of this.resolvedTimeline.objectsMap.values()) {
                validObjects[obj.id] = obj;
            }
            /** All references that depend on another reference (ie objects, classs or layers): */
            const affectReferenceMap = {};
            for (const obj of this.resolvedTimeline.objectsMap.values()) {
                // Add everything that this object affects:
                const cachedObj = this.cache.objects[obj.id];
                let affectedReferences = this.getAllReferencesThisObjectAffects(obj);
                if (cachedObj) {
                    affectedReferences = (0, reference_1.joinReferences)(affectedReferences, this.getAllReferencesThisObjectAffects(cachedObj));
                }
                for (let i = 0; i < affectedReferences.length; i++) {
                    const ref = affectedReferences[i];
                    const objRef = `#${obj.id}`;
                    if (ref !== objRef) {
                        if (!affectReferenceMap[objRef])
                            affectReferenceMap[objRef] = [];
                        affectReferenceMap[objRef].push(ref);
                    }
                }
                // Add everything that this object is affected by:
                if (changedReferences[`#${obj.id}`]) {
                    // The object is directly said to be invalid, no need to add it to referencingObjects,
                    // since it'll be easily invalidated anyway later
                }
                else {
                    // Note: we only have to check for the OLD object, since if the old and the new object differs,
                    // that would mean it'll be directly invalidated anyway.
                    if (cachedObj) {
                        // Fetch all references for the object from the last time it was resolved.
                        // Note: This can be done, since _if_ the object was changed in any way since last resolve
                        // it'll be invalidated anyway
                        const dependOnReferences = cachedObj.resolved.directReferences;
                        for (let i = 0; i < dependOnReferences.length; i++) {
                            const ref = dependOnReferences[i];
                            if (!affectReferenceMap[ref])
                                affectReferenceMap[ref] = [];
                            affectReferenceMap[ref].push(`#${obj.id}`);
                        }
                    }
                }
            }
            // Invalidate all changed objects, and recursively invalidate all objects that reference those objects:
            const handledReferences = {};
            for (const reference of Object.keys(changedReferences)) {
                this.invalidateObjectsWithReference(handledReferences, reference, affectReferenceMap, validObjects);
            }
            // The objects that are left in validObjects at this point are still valid.
            // We can reuse the old resolving for those:
            for (const obj of Object.values(validObjects)) {
                if (!this.cache.objects[obj.id])
                    /* istanbul ignore next */
                    throw new Error(`Something went wrong: "${obj.id}" does not exist in cache.resolvedTimeline.objects`);
                this.resolvedTimeline.objectsMap.set(obj.id, this.cache.objects[obj.id]);
            }
        }
        toc();
    }
    persistData() {
        const toc = (0, performance_1.tic)('  cache.persistData');
        if (this.resolvedTimeline.resolveError) {
            // If there was a resolve error, clear the cache:
            this.cache.objHashes = {};
            this.cache.objects = {};
            this.cache.canBeUsed = false;
        }
        else {
            this.cache.objects = (0, lib_1.mapToObject)(this.resolvedTimeline.objectsMap);
            this.cache.canBeUsed = true;
        }
        toc();
    }
    getAllReferencesThisObjectAffects(newObj) {
        const references = [`#${newObj.id}`];
        if (newObj.classes) {
            for (const className of newObj.classes) {
                references.push(`.${className}`);
            }
        }
        if ((0, timeline_1.objHasLayer)(newObj))
            references.push(`$${newObj.layer}`);
        if (newObj.children) {
            for (const child of newObj.children) {
                references.push(`#${child.id}`);
            }
        }
        return references;
    }
    /** Invalidate all changed objects, and recursively invalidate all objects that reference those objects */
    invalidateObjectsWithReference(handledReferences, reference, affectReferenceMap, validObjects) {
        if (handledReferences[reference])
            return; // to avoid infinite loops
        handledReferences[reference] = true;
        if ((0, reference_1.isObjectReference)(reference)) {
            const objId = (0, reference_1.getRefObjectId)(reference);
            if (validObjects[objId]) {
                delete validObjects[objId];
            }
        }
        // Invalidate all objects that depend on any of the references that this reference affects:
        const affectedReferences = affectReferenceMap[reference];
        if (affectedReferences) {
            for (let i = 0; i < affectedReferences.length; i++) {
                const referencingReference = affectedReferences[i];
                this.invalidateObjectsWithReference(handledReferences, referencingReference, affectReferenceMap, validObjects);
            }
        }
    }
}
exports.CacheHandler = CacheHandler;
/** Return a "hash-string" which changes whenever anything that affects timing of a timeline-object has changed. */
function hashTimelineObject(obj) {
    /*
    Note: The following properties are ignored, as they don't affect timing or resolving:
     * id
     * children
     * keyframes
     * isGroup
     * content
     */
    return `${JSON.stringify(obj.enable)},${+!!obj.disabled},${obj.priority}',${obj.resolved.parentId},${+obj.resolved
        .isKeyframe},${obj.classes ? obj.classes.join('.') : ''},${obj.layer},${+!!obj.seamless}`;
}
exports.hashTimelineObject = hashTimelineObject;

},{"./lib/lib":28,"./lib/performance":29,"./lib/reference":30,"./lib/timeline":31}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressionHandler = exports.REGEXP_OPERATORS = exports.OPERATORS = void 0;
const lib_1 = require("./lib/lib");
const cache_1 = require("./lib/cache");
const expression_1 = require("./lib/expression");
exports.OPERATORS = ['&', '|', '+', '-', '*', '/', '%', '!'];
exports.REGEXP_OPERATORS = new RegExp('([' + exports.OPERATORS.map((o) => '\\' + o).join('') + '\\(\\)])', 'g');
class ExpressionHandler {
    constructor(autoClearCache, skipValidation) {
        this.skipValidation = skipValidation;
        this.cache = new cache_1.Cache(autoClearCache);
    }
    interpretExpression(expression) {
        if ((0, expression_1.isNumericExpr)(expression)) {
            return parseFloat(expression);
        }
        else if (typeof expression === 'string') {
            const expressionString = expression;
            return this.cache.cacheResult(expressionString, () => {
                const expr = expressionString.replace(exports.REGEXP_OPERATORS, ' $1 '); // Make sure there's a space between every operator & operand
                const words = (0, lib_1.compact)(expr.split(' '));
                if (words.length === 0)
                    return null; // empty expression
                // Fix special case: a + - b
                for (let i = words.length - 2; i >= 1; i--) {
                    if ((words[i] === '-' || words[i] === '+') && wordIsOperator(exports.OPERATORS, words[i - 1])) {
                        words[i] = words[i] + words[i + 1];
                        words.splice(i + 1, 1);
                    }
                }
                const innerExpression = this.wrapInnerExpressions(words);
                if (innerExpression.rest.length)
                    throw new Error(`interpretExpression: syntax error: parentheses don't add up in "${expr}".`);
                if (innerExpression.inner.length % 2 !== 1) {
                    throw new Error(`interpretExpression: operands & operators don't add up: "${innerExpression.inner.join(' ')}".`);
                }
                const returnExpression = this.words2Expression(exports.OPERATORS, innerExpression.inner);
                if (!this.skipValidation)
                    this.validateExpression(exports.OPERATORS, returnExpression);
                return returnExpression;
            }, 60 * 60 * 1000 // 1 hour
            );
        }
        else {
            return expression;
        }
    }
    /** Try to simplify an expression, this includes:
     * * Combine constant operands, using arithmetic operators
     * ...more to come?
     */
    simplifyExpression(expr0) {
        const expr = typeof expr0 === 'string' ? this.interpretExpression(expr0) : expr0;
        if (!expr)
            return expr;
        if (isExpressionObject(expr)) {
            const l = this.simplifyExpression(expr.l);
            const o = expr.o;
            const r = this.simplifyExpression(expr.r);
            if (typeof l === 'number' && typeof r === 'number') {
                // The operands can be combined:
                switch (o) {
                    case '+':
                        return l + r;
                    case '-':
                        return l - r;
                    case '*':
                        return l * r;
                    case '/':
                        return l / r;
                    case '%':
                        return l % r;
                    default:
                        return { l, o, r };
                }
            }
            return { l, o, r };
        }
        return expr;
    }
    // Turns ['a', '(', 'b', 'c', ')'] into ['a', ['b', 'c']]
    // or ['a', '&', '!', 'b'] into ['a', '&', ['', '!', 'b']]
    wrapInnerExpressions(words) {
        for (let i = 0; i < words.length; i++) {
            switch (words[i]) {
                case '(': {
                    const tmp = this.wrapInnerExpressions(words.slice(i + 1));
                    // insert inner expression and remove tha
                    words[i] = tmp.inner;
                    words.splice(i + 1, 99999, ...tmp.rest);
                    break;
                }
                case ')':
                    return {
                        inner: words.slice(0, i),
                        rest: words.slice(i + 1),
                    };
                case '!': {
                    const tmp = this.wrapInnerExpressions(words.slice(i + 1));
                    // insert inner expression after the '!'
                    words[i] = ['', '!'].concat(tmp.inner);
                    words.splice(i + 1, 99999, ...tmp.rest);
                    break;
                }
            }
        }
        return {
            inner: words,
            rest: [],
        };
    }
    /** Validates an expression. Returns true on success, throws error if not */
    validateExpression(operatorList, expr0, breadcrumbs) {
        if (!breadcrumbs)
            breadcrumbs = 'ROOT';
        if ((0, lib_1.isObject)(expr0) && !(0, lib_1.isArray)(expr0)) {
            const expr = expr0;
            if (expr.l === undefined)
                throw new Error(`validateExpression: ${breadcrumbs}.l missing in ${JSON.stringify(expr)}`);
            if (expr.o === undefined)
                throw new Error(`validateExpression: ${breadcrumbs}.o missing in ${JSON.stringify(expr)}`);
            if (expr.r === undefined)
                throw new Error(`validateExpression: ${breadcrumbs}.r missing in ${JSON.stringify(expr)}`);
            if (typeof expr.o !== 'string')
                throw new Error(`validateExpression: ${breadcrumbs}.o not a string`);
            if (!wordIsOperator(operatorList, expr.o))
                throw new Error(breadcrumbs + '.o not valid: "' + expr.o + '"');
            return (this.validateExpression(operatorList, expr.l, breadcrumbs + '.l') &&
                this.validateExpression(operatorList, expr.r, breadcrumbs + '.r'));
        }
        else if (expr0 !== null && typeof expr0 !== 'string' && typeof expr0 !== 'number') {
            throw new Error(`validateExpression: ${breadcrumbs} is of invalid type`);
        }
        return true;
    }
    clearCache() {
        this.cache.clear();
    }
    words2Expression(operatorList, words) {
        /* istanbul ignore if */
        if (!words?.length)
            throw new Error('words2Expression: syntax error: unbalanced expression');
        while (words.length === 1 && words[0] !== null && (0, lib_1.isArray)(words[0]))
            words = words[0];
        if (words.length === 1)
            return words[0];
        // Find the operator with the highest priority:
        let operatorI = -1;
        for (let i = 0; i < operatorList.length; i++) {
            const operator = operatorList[i];
            if (operatorI === -1) {
                operatorI = words.lastIndexOf(operator);
            }
        }
        if (operatorI !== -1) {
            const l = words.slice(0, operatorI);
            const r = words.slice(operatorI + 1);
            const expr = {
                l: this.words2Expression(operatorList, l),
                o: words[operatorI],
                r: this.words2Expression(operatorList, r),
            };
            return expr;
        }
        else
            throw new Error('words2Expression: syntax error: operator not found: "' + words.join(' ') + '"');
    }
}
exports.ExpressionHandler = ExpressionHandler;
function isExpressionObject(expr) {
    return (typeof expr === 'object' &&
        expr !== null &&
        expr.l !== undefined &&
        expr.o !== undefined &&
        expr.r !== undefined);
}
function wordIsOperator(operatorList, word) {
    if (operatorList.indexOf(word) !== -1)
        return true;
    return false;
}

},{"./lib/cache":23,"./lib/expression":26,"./lib/lib":28}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceHandler = void 0;
const cap_1 = require("./lib/cap");
const event_1 = require("./lib/event");
const instance_1 = require("./lib/instance");
const lib_1 = require("./lib/lib");
const reference_1 = require("./lib/reference");
class InstanceHandler {
    constructor(resolvedTimeline) {
        this.resolvedTimeline = resolvedTimeline;
    }
    invertInstances(instances) {
        if (instances.length) {
            instances = this.cleanInstances(instances, true, true);
            const invertedInstances = [];
            if (instances[0].start !== 0) {
                invertedInstances.push({
                    id: this.resolvedTimeline.getInstanceId(),
                    isFirst: true,
                    start: 0,
                    end: null,
                    references: (0, reference_1.joinReferences)(instances[0].references, `@${instances[0].id}`),
                });
            }
            for (let i = 0; i < instances.length; i++) {
                const instance = instances[i];
                const lastInstance = (0, lib_1.last)(invertedInstances);
                if (lastInstance) {
                    lastInstance.end = instance.start;
                }
                if (instance.end !== null) {
                    invertedInstances.push({
                        id: this.resolvedTimeline.getInstanceId(),
                        start: instance.end,
                        end: null,
                        references: (0, reference_1.joinReferences)(instance.references, `@${instance.id}`),
                        caps: instance.caps,
                    });
                }
            }
            return invertedInstances;
        }
        else {
            return [
                {
                    id: this.resolvedTimeline.getInstanceId(),
                    isFirst: true,
                    start: 0,
                    end: null,
                    references: [],
                },
            ];
        }
    }
    /**
     * Converts a list of events into a list of instances.
     * @param events The list of start- and end- events
     * @param allowMerge If true, will merge instances that overlap into one.
     * @param allowZeroGaps If true, allows zero-length gaps between instances. If false, will combine the two into one instance.
     * @param omitOriginalStartEnd Of true, will not keep .originalStart and .originalEnd of the instances
     */
    convertEventsToInstances(events, allowMerge, allowZeroGaps = false, omitOriginalStartEnd = false) {
        (0, event_1.sortEvents)(events);
        const activeInstances = {};
        let activeInstanceId = null;
        let previousActive = false;
        const negativeInstances = {};
        let previousNegative = false;
        let negativeInstanceId = null;
        const returnInstances = [];
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const eventId = event.data.id ?? event.data.instance.id;
            const lastInstance = returnInstances[returnInstances.length - 1];
            if (event.value) {
                // Start-event
                activeInstances[eventId] = event;
                delete negativeInstances[eventId];
            }
            else {
                // End-event
                delete activeInstances[eventId];
                negativeInstances[eventId] = event;
            }
            if (Object.keys(activeInstances).length) {
                // There is an active instance
                if (!allowMerge && !allowZeroGaps && lastInstance && previousNegative) {
                    // There is previously an inActive (negative) instance
                    lastInstance.start = event.time;
                }
                else {
                    const o = this.handleActiveInstances(event, lastInstance, activeInstanceId, eventId, activeInstances, allowMerge, allowZeroGaps);
                    activeInstanceId = o.activeInstanceId;
                    if (o.returnInstance) {
                        let newInstance = o.returnInstance;
                        if (omitOriginalStartEnd) {
                            newInstance = { ...newInstance };
                            newInstance.originalStart = undefined;
                            newInstance.originalEnd = undefined;
                        }
                        returnInstances.push(newInstance);
                    }
                }
                previousActive = true;
                previousNegative = false;
            }
            else {
                // No instances are active
                if (lastInstance && previousActive) {
                    lastInstance.end = event.time;
                }
                else if (Object.keys(negativeInstances).length && !event.data.notANegativeInstance) {
                    // There is a negative instance running
                    const o = this.handleActiveInstances(event, lastInstance, negativeInstanceId, eventId, negativeInstances, allowMerge, allowZeroGaps);
                    negativeInstanceId = o.activeInstanceId;
                    if (o.returnInstance) {
                        const newInstance = {
                            ...o.returnInstance,
                            start: o.returnInstance.end ?? 0,
                            end: o.returnInstance.start,
                        };
                        if (omitOriginalStartEnd) {
                            newInstance.originalStart = undefined;
                            newInstance.originalEnd = undefined;
                        }
                        returnInstances.push(newInstance);
                    }
                    previousNegative = true;
                }
                previousActive = false;
            }
        }
        for (const instance of returnInstances) {
            if (instance.end !== null && instance.end < instance.start) {
                // Don't allow negative durations, set it to zero instead:
                instance.end = instance.start;
            }
        }
        return returnInstances;
    }
    handleActiveInstances(event, lastInstance, activeInstanceId, eventId, activeInstances, allowMerge, allowZeroGaps = false) {
        let returnInstance = null;
        if (!allowMerge &&
            event.value &&
            lastInstance &&
            lastInstance.end === null &&
            activeInstanceId !== null &&
            activeInstanceId !== eventId) {
            // Start a new instance:
            lastInstance.end = event.time;
            returnInstance = {
                id: this.resolvedTimeline.getInstanceId(),
                start: event.time,
                end: null,
                references: event.references,
                originalEnd: event.data.instance.originalEnd,
                originalStart: event.data.instance.originalStart,
            };
            activeInstanceId = eventId;
        }
        else if (!allowMerge && !event.value && lastInstance && activeInstanceId === eventId) {
            // The active instance stopped playing, but another is still playing
            const latestInstance = (0, lib_1.reduceObj)(activeInstances, (memo, instanceEvent, id) => {
                if (memo === null || memo.event.time < instanceEvent.time) {
                    return {
                        event: instanceEvent,
                        id: id,
                    };
                }
                return memo;
            }, null);
            if (latestInstance) {
                // Restart that instance now:
                lastInstance.end = event.time;
                returnInstance = {
                    id: (0, instance_1.isInstanceId)(eventId)
                        ? `${eventId}_${this.resolvedTimeline.getInstanceId()}`
                        : `@${eventId}_${this.resolvedTimeline.getInstanceId()}`,
                    start: event.time,
                    end: null,
                    references: latestInstance.event.references,
                    originalEnd: event.data.instance.originalEnd,
                    originalStart: event.data.instance.originalStart,
                };
                activeInstanceId = latestInstance.id;
            }
        }
        else if (allowMerge && !allowZeroGaps && lastInstance && lastInstance.end === event.time) {
            // The previously running ended just now
            // resume previous instance:
            lastInstance.end = null;
            lastInstance.references = (0, reference_1.joinReferences)(lastInstance.references, event.references);
            (0, cap_1.addCapsToResuming)(lastInstance, event.data.instance.caps);
        }
        else if (!lastInstance || lastInstance.end !== null) {
            // There is no previously running instance
            // Start a new instance:
            returnInstance = {
                id: (0, instance_1.isInstanceId)(eventId) ? eventId : `@${eventId}`,
                start: event.time,
                end: null,
                references: event.references,
                caps: event.data.instance.caps,
                originalEnd: event.data.instance.originalEnd,
                originalStart: event.data.instance.originalStart,
            };
            activeInstanceId = eventId;
        }
        else {
            // There is already a running instance
            lastInstance.references = (0, reference_1.joinReferences)(lastInstance.references, event.references);
            (0, cap_1.addCapsToResuming)(lastInstance, event.data.instance.caps);
        }
        if (lastInstance?.caps && !lastInstance.caps.length)
            delete lastInstance.caps;
        if (returnInstance &&
            lastInstance &&
            lastInstance.start === lastInstance.end &&
            lastInstance.end === returnInstance.start) {
            // replace the previous zero-length with this one instead
            lastInstance.id = returnInstance.id;
            lastInstance.start = returnInstance.start;
            lastInstance.end = returnInstance.end;
            lastInstance.references = returnInstance.references;
            lastInstance.caps = returnInstance.caps;
            lastInstance.originalStart = returnInstance.originalStart;
            lastInstance.originalEnd = returnInstance.originalEnd;
            returnInstance = null;
        }
        return {
            activeInstanceId,
            returnInstance,
        };
    }
    /**
     * Clean up instances, join overlapping etc..
     * @param instances
     */
    cleanInstances(instances, allowMerge, allowZeroGaps = false) {
        // First, optimize for certain common situations:
        if (instances.length === 0)
            return [];
        if (instances.length === 1)
            return instances;
        const events = [];
        for (const instance of instances) {
            events.push({
                time: instance.start,
                value: true,
                data: { instance: instance },
                references: instance.references,
            });
            if (instance.end !== null) {
                events.push({
                    time: instance.end,
                    value: false,
                    data: { instance: instance },
                    references: instance.references,
                });
            }
        }
        return this.convertEventsToInstances(events, allowMerge, allowZeroGaps);
    }
    /**
     * Cap instances so that they are within their parentInstances
     * @param instances
     * @param cappingInstances
     */
    capInstances(instances, cappingInstances, allowZeroGaps = true) {
        if ((0, reference_1.isReference)(cappingInstances) || cappingInstances === null)
            return instances;
        let returnInstances = [];
        for (let i = 0; i < instances.length; i++) {
            const instanceOrg = instances[i];
            const addedInstanceTimes = new Set();
            for (let j = 0; j < cappingInstances.length; j++) {
                const capInstance = cappingInstances[j];
                // First, check if the instance crosses the parent at all:
                if (instanceOrg.start <= (capInstance.end ?? Infinity) &&
                    (instanceOrg.end ?? Infinity) >= capInstance.start) {
                    const instance = this.capInstance(instanceOrg, capInstance);
                    if (instance.start >= capInstance.start &&
                        (instance.end ?? Infinity) <= (capInstance.end ?? Infinity)) {
                        // The instance is within the parent
                        if (instance.start === instance.end && addedInstanceTimes.has(instance.start)) {
                            // Don't add zero-length instances if there are already is instances covering that time
                        }
                        else {
                            instance.references = (0, reference_1.joinReferences)(instance.references, capInstance.references);
                            returnInstances.push(instance);
                            addedInstanceTimes.add(instance.start);
                            if (instance.end)
                                addedInstanceTimes.add(instance.end);
                        }
                    }
                }
            }
        }
        returnInstances.sort((a, b) => a.start - b.start);
        // Ensure unique ids:
        const ids = {};
        for (const instance of returnInstances) {
            // tslint:disable-next-line
            if (ids[instance.id] !== undefined) {
                instance.id = `${instance.id}${++ids[instance.id]}`;
            }
            else {
                ids[instance.id] = 0;
            }
        }
        // Clean up the instances, to remove duplicates
        returnInstances = this.cleanInstances(returnInstances, true, allowZeroGaps);
        return returnInstances;
    }
    capInstance(instanceOrg, capInstance) {
        const instance = { ...instanceOrg };
        // Cap start
        if (instance.start < capInstance.start) {
            this.setInstanceStartTime(instance, capInstance.start);
        }
        // Cap end
        if ((instance.end ?? Infinity) > (capInstance.end ?? Infinity)) {
            this.setInstanceEndTime(instance, capInstance.end);
        }
        return instance;
    }
    setInstanceEndTime(instance, endTime) {
        instance.originalEnd = instance.originalEnd ?? instance.end;
        instance.end = endTime;
    }
    setInstanceStartTime(instance, startTime) {
        instance.originalStart = instance.originalStart ?? instance.start;
        instance.start = startTime;
    }
    applyRepeatingInstances(instances, repeatTime0) {
        if (repeatTime0 === null || !repeatTime0.value)
            return instances;
        const options = this.resolvedTimeline.options;
        const repeatTime = repeatTime0.value;
        const repeatedInstances = [];
        for (const instance of instances) {
            let startTime = Math.max(options.time - ((options.time - instance.start) % repeatTime), instance.start);
            let endTime = instance.end === null ? null : instance.end + (startTime - instance.start);
            const cap = (instance.caps
                ? instance.caps.find((cap) => instance.references.indexOf(`@${cap.id}`) !== -1)
                : null) ?? null;
            const limit = options.limitCount ?? 2;
            for (let i = 0; i < limit; i++) {
                if (options.limitTime && startTime >= options.limitTime)
                    break;
                const cappedStartTime = cap ? Math.max(cap.start, startTime) : startTime;
                const cappedEndTime = cap && cap.end !== null && endTime !== null ? Math.min(cap.end, endTime) : endTime;
                if ((cappedEndTime ?? Infinity) > cappedStartTime) {
                    repeatedInstances.push({
                        id: this.resolvedTimeline.getInstanceId(),
                        start: cappedStartTime,
                        end: cappedEndTime,
                        references: (0, reference_1.joinReferences)(instance.references, repeatTime0.references, `@${instance.id}`),
                    });
                }
                startTime += repeatTime;
                if (endTime !== null)
                    endTime += repeatTime;
            }
        }
        return this.cleanInstances(repeatedInstances, false);
    }
}
exports.InstanceHandler = InstanceHandler;

},{"./lib/cap":24,"./lib/event":25,"./lib/instance":27,"./lib/lib":28,"./lib/reference":30}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayerStateHandler = void 0;
const lib_1 = require("./lib/lib");
const performance_1 = require("./lib/performance");
/**
 * LayerStateHandler instances are short-lived.
 * They are initialized, .resolveConflicts() is called and then discarded
 */
class LayerStateHandler {
    constructor(resolvedTimeline, instance, layer) {
        this.resolvedTimeline = resolvedTimeline;
        this.instance = instance;
        this.layer = layer;
        this.pointsInTime = {};
        this.objectsOnLayer = [];
        this.objectIdsOnLayer = this.resolvedTimeline.getLayerObjects(layer);
    }
    debug(...args) {
        if (this.resolvedTimeline.options.debug)
            console.log(...args);
    }
    /** Resolve conflicts between objects on the layer. */
    resolveConflicts() {
        const toc = (0, performance_1.tic)('       resolveConflicts');
        /*
            This algoritm basically works like this:

            1. Collect all instances start- and end-times as points-of-interest
            2. Sweep through the points-of-interest and determine which instance is the "winning one" at every point in time
        */
        // Populate this.objectsOnLayer:
        for (const objId of this.objectIdsOnLayer) {
            this.objectsOnLayer.push(this.resolvedTimeline.getObject(objId));
        }
        // Fast-path: if there's only one object on the layer, it can't conflict with anything
        if (this.objectsOnLayer.length === 1) {
            for (const obj of this.objectsOnLayer) {
                obj.resolved.resolvedConflicts = true;
                for (const instance of obj.resolved.instances) {
                    instance.originalStart = instance.originalStart ?? instance.start;
                    instance.originalEnd = instance.originalEnd ?? instance.end;
                }
            }
            return;
        }
        this.debug(`======= resolveConflicts "${this.layer}" (${this.objectsOnLayer.length} objects)`);
        // Sort to make sure parent groups are evaluated before their children:
        this.objectsOnLayer.sort(compareObjectsOnLayer);
        // Step 1: Collect all points-of-interest (which points in time we want to evaluate)
        // and which instances that are interesting
        for (const obj of this.objectsOnLayer) {
            // Notes:
            // Since keyframes can't be placed on a layer, we assume that the object is not a keyframe
            // We also assume that the object has a layer
            for (const instance of obj.resolved.instances) {
                const timeEvents = [];
                timeEvents.push({ time: instance.start, enable: true });
                if (instance.end)
                    timeEvents.push({ time: instance.end, enable: false });
                // Save a reference to this instance on all points in time that could affect it:
                for (const timeEvent of timeEvents) {
                    if (timeEvent.enable) {
                        this.addPointInTime(timeEvent.time, 'start', obj, instance);
                    }
                    else {
                        this.addPointInTime(timeEvent.time, 'end', obj, instance);
                    }
                }
            }
            obj.resolved.resolvedConflicts = true;
            obj.resolved.instances.splice(0); // clear the instances, so new instances can be re-added later
        }
        // Step 2: Resolve the state for the points-of-interest
        // This is done by sweeping the points-of-interest chronologically,
        // determining the state for every point in time by adding & removing objects from aspiringInstances
        // Then sorting it to determine who takes precedence
        let currentState = undefined;
        const activeObjIds = {};
        /** The objects in aspiringInstances  */
        let aspiringInstances = [];
        const times = Object.keys(this.pointsInTime)
            .map((time) => parseFloat(time))
            // Sort chronologically:
            .sort((a, b) => a - b);
        // Iterate through all points-of-interest times:
        for (const time of times) {
            this.debug(`-------------- time: ${time}`);
            /** A set of identifiers for which instance-events have been check at this point in time. Used to avoid looking at the same object twice. */
            const checkedThisTime = new Set();
            /** List of the instances to check at this point in time. */
            const instancesToCheck = this.pointsInTime[time];
            instancesToCheck.sort(compareInstancesToCheck);
            for (let j = 0; j < instancesToCheck.length; j++) {
                const o = instancesToCheck[j];
                const obj = o.obj;
                const instance = o.instance;
                let toBeEnabled;
                if (instance.start === time && instance.end === time) {
                    // Handle zero-length instances:
                    if (o.instanceEvent === 'start')
                        toBeEnabled = true; // Start a zero-length instance
                    else
                        toBeEnabled = false; // End a zero-length instance
                }
                else {
                    toBeEnabled = (instance.start || 0) <= time && (instance.end ?? Infinity) > time;
                }
                const identifier = `${obj.id}_${instance.id}_${o.instanceEvent}`;
                if (!checkedThisTime.has(identifier)) {
                    // Only check each object and event-type once for every point in time
                    checkedThisTime.add(identifier);
                    if (toBeEnabled) {
                        // The instance wants to be enabled (is starting)
                        // Add to aspiringInstances:
                        aspiringInstances.push({ obj, instance });
                    }
                    else {
                        // The instance doesn't want to be enabled (is ending)
                        // Remove from aspiringInstances:
                        aspiringInstances = removeFromAspiringInstances(aspiringInstances, obj.id);
                    }
                    // Sort the instances on layer to determine who is the active one:
                    aspiringInstances.sort(compareAspiringInstances);
                    // At this point, the first instance in aspiringInstances is the active one.
                    const instanceOnTopOfLayer = aspiringInstances[0];
                    // Update current state:
                    const prevObjInstance = currentState;
                    const replaceOld = instanceOnTopOfLayer &&
                        (!prevObjInstance ||
                            prevObjInstance.id !== instanceOnTopOfLayer.obj.id ||
                            !prevObjInstance.instance.id.startsWith(`${instanceOnTopOfLayer.instance.id}`));
                    const removeOld = !instanceOnTopOfLayer && prevObjInstance;
                    if (replaceOld || removeOld) {
                        if (prevObjInstance) {
                            // Cap the old instance, so it'll end at this point in time:
                            this.instance.setInstanceEndTime(prevObjInstance.instance, time);
                            this.debug(`${prevObjInstance.id} stop`);
                            // Update activeObjIds:
                            delete activeObjIds[prevObjInstance.id];
                        }
                    }
                    if (replaceOld) {
                        // Set the new objectInstance to be the current one:
                        const currentObj = instanceOnTopOfLayer.obj;
                        this.debug(`${currentObj.id} play`);
                        const newInstance = {
                            ...instanceOnTopOfLayer.instance,
                            // We're setting new start & end times so they match up with the state:
                            start: time,
                            end: null,
                            fromInstanceId: instanceOnTopOfLayer.instance.id,
                            originalEnd: instanceOnTopOfLayer.instance.originalEnd ?? instanceOnTopOfLayer.instance.end,
                            originalStart: instanceOnTopOfLayer.instance.originalStart ?? instanceOnTopOfLayer.instance.start,
                        };
                        // Make the instance id unique:
                        for (let i = 0; i < currentObj.resolved.instances.length; i++) {
                            if (currentObj.resolved.instances[i].id === newInstance.id) {
                                newInstance.id = `${newInstance.id}_$${currentObj.resolved.instances.length}`;
                            }
                        }
                        currentObj.resolved.instances.push(newInstance);
                        const newObjInstance = {
                            ...currentObj,
                            instance: newInstance,
                        };
                        // Save to current state:
                        currentState = newObjInstance;
                        // Update activeObjIds:
                        activeObjIds[newObjInstance.id] = newObjInstance;
                    }
                    else if (removeOld) {
                        // Remove from current state:
                        currentState = undefined;
                    }
                }
            }
        }
        // At this point, the instances of all objects are calculated,
        // taking into account priorities, clashes etc.
        // Cap children inside their parents:
        // Functionally, this isn't needed since this is done in ResolvedTimelineHandler.resolveTimelineObj() anyway.
        // However by capping children here some re-evaluating iterations can be avoided, so this increases performance.
        {
            const allChildren = this.objectsOnLayer
                .filter((obj) => !!obj.resolved.parentId)
                // Sort, so that the outermost are handled first:
                .sort((a, b) => {
                return a.resolved.levelDeep - b.resolved.levelDeep;
            });
            for (const obj of allChildren) {
                if (obj.resolved.parentId) {
                    const parent = this.resolvedTimeline.getObject(obj.resolved.parentId);
                    if (parent) {
                        obj.resolved.instances = this.instance.cleanInstances(this.instance.capInstances(obj.resolved.instances, parent.resolved.instances), false, false);
                    }
                }
            }
        }
        this.debug('==== resolveConflicts done');
        toc();
    }
    /** Add an instance and event to a certain point-in-time */
    addPointInTime(time, instanceEvent, obj, instance) {
        // Note on order: Ending events come before starting events
        this.debug('addPointInTime', time, instanceEvent, instance);
        if (!this.pointsInTime[time + ''])
            this.pointsInTime[time + ''] = [];
        this.pointsInTime[time + ''].push({ obj, instance, instanceEvent });
    }
}
exports.LayerStateHandler = LayerStateHandler;
function compareObjectsOnLayer(a, b) {
    // Sort to make sure parent groups are evaluated before their children:
    return a.resolved.levelDeep - b.resolved.levelDeep || (0, lib_1.compareStrings)(a.id, b.id);
}
function compareInstancesToCheck(a, b) {
    // Note: we assume that there are no keyframes here. (if there where, they would be sorted first)
    if (a.instance.id === b.instance.id && a.instance.start === b.instance.start && a.instance.end === b.instance.end) {
        // A & B are the same instance, it is a zero-length instance!
        // In this case, put the start before the end:
        if (a.instanceEvent === 'start' && b.instanceEvent === 'end')
            return -1;
        if (a.instanceEvent === 'end' && b.instanceEvent === 'start')
            return 1;
    }
    // Handle ending instances first:
    if (a.instanceEvent === 'start' && b.instanceEvent === 'end')
        return 1;
    if (a.instanceEvent === 'end' && b.instanceEvent === 'start')
        return -1;
    if (a.instance.start === a.instance.end || b.instance.start === b.instance.end) {
        // Put later-ending instances last (in the case of zero-length vs non-zero-length instance):
        const difference = (a.instance.end ?? Infinity) - (b.instance.end ?? Infinity);
        if (difference)
            return difference;
    }
    if (a.obj.resolved && b.obj.resolved) {
        // Deeper objects (children in groups) comes later, we want to check the parent groups first:
        const difference = a.obj.resolved.levelDeep - b.obj.resolved.levelDeep;
        if (difference)
            return difference;
    }
    // Last resort, sort by id to make it deterministic:
    return (0, lib_1.compareStrings)(a.obj.id, b.obj.id) || (0, lib_1.compareStrings)(a.instance.id, b.instance.id);
}
const removeFromAspiringInstances = (aspiringInstances, objId) => {
    const returnInstances = [];
    for (let i = 0; i < aspiringInstances.length; i++) {
        if (aspiringInstances[i].obj.id !== objId)
            returnInstances.push(aspiringInstances[i]);
    }
    return returnInstances;
};
function compareAspiringInstances(a, b) {
    // Determine who takes precedence:
    return ((b.obj.priority || 0) - (a.obj.priority || 0) || // First, sort using priority
        b.instance.start - a.instance.start || // Then, sort using the start time
        (0, lib_1.compareStrings)(a.obj.id, b.obj.id) || // Last resort, sort by id to make it deterministic
        (0, lib_1.compareStrings)(a.instance.id, b.instance.id));
}

},{"./lib/lib":28,"./lib/performance":29}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceHandler = void 0;
const lib_1 = require("./lib/lib");
const cap_1 = require("./lib/cap");
const event_1 = require("./lib/event");
const reference_1 = require("./lib/reference");
const expression_1 = require("./lib/expression");
class ReferenceHandler {
    constructor(resolvedTimeline, instance) {
        this.resolvedTimeline = resolvedTimeline;
        this.instance = instance;
        this.operateApplyParentInstance = (a, b) => {
            if (a === null || b === null)
                return null;
            return {
                value: a.value + b.value,
                references: (0, reference_1.joinReferences)(a.references, b.references),
            };
        };
    }
    /**
     * Look up a reference on the timeline
     * Return values:
     * TimelineObjectInstance[]: Instances on the timeline where the reference expression is true
     * ValueWithReference: A singular value which can be combined arithmetically with Instances
     * null: Means "something is invalid", an null-value will always return null when combined with other values
     *
     * @param obj
     * @param expr
     * @param context
     */
    lookupExpression(obj, expr, context) {
        if (expr === null)
            return { result: null, allReferences: [] };
        if (typeof expr === 'string' && (0, expression_1.isNumericExpr)(expr)) {
            return {
                result: {
                    value: parseFloat(expr),
                    references: [],
                },
                allReferences: [],
            };
        }
        else if (typeof expr === 'number') {
            return {
                result: {
                    value: expr,
                    references: [],
                },
                allReferences: [],
            };
        }
        else if (typeof expr === 'string') {
            expr = expr.trim();
            const exprLower = expr.toLowerCase();
            if (exprLower === 'true') {
                return {
                    result: {
                        value: 0,
                        references: [],
                    },
                    allReferences: [],
                };
            }
            else if (exprLower === 'false') {
                return {
                    result: null,
                    allReferences: [],
                };
            }
            // Look up string
            let referencedObjs = [];
            let ref = context;
            let rest = '';
            let objIdsToReference = [];
            const allReferences = [];
            let referenceIsOk = false;
            // Match id, example: "#objectId.start"
            const m = /^\W*#([^.]+)(.*)/.exec(expr);
            if (m) {
                const id = m[1];
                rest = m[2];
                referenceIsOk = true;
                objIdsToReference = [id];
                allReferences.push(`#${id}`);
            }
            else {
                // Match class, example: ".className.start"
                const m = /^\W*\.([^.]+)(.*)/.exec(expr);
                if (m) {
                    const className = m[1];
                    rest = m[2];
                    referenceIsOk = true;
                    objIdsToReference = this.resolvedTimeline.getClassObjects(className) ?? [];
                    allReferences.push(`.${className}`);
                }
                else {
                    // Match layer, example: "$layer"
                    const m = /^\W*\$([^.]+)(.*)/.exec(expr);
                    if (m) {
                        const layer = m[1];
                        rest = m[2];
                        referenceIsOk = true;
                        objIdsToReference = this.resolvedTimeline.getLayerObjects(layer) ?? [];
                        allReferences.push(`$${layer}`);
                    }
                }
            }
            for (let i = 0; i < objIdsToReference.length; i++) {
                const refObjId = objIdsToReference[i];
                if (refObjId === obj.id) {
                    // Looks like the object is referencing itself!
                    if (obj.resolved.resolving) {
                        obj.resolved.isSelfReferencing = true;
                    }
                }
                else {
                    const refObj = this.resolvedTimeline.getObject(refObjId);
                    if (refObj)
                        referencedObjs.push(refObj);
                }
            }
            if (!referenceIsOk) {
                return { result: null, allReferences: [] };
            }
            if (obj.resolved.isSelfReferencing) {
                // Exclude any self-referencing objects:
                referencedObjs = referencedObjs.filter((refObj) => {
                    return !refObj.resolved.isSelfReferencing;
                });
            }
            if (referencedObjs.length) {
                if (/start/.exec(rest))
                    ref = 'start';
                else if (/end/.exec(rest))
                    ref = 'end';
                else if (/duration/.exec(rest))
                    ref = 'duration';
                if (ref === 'duration') {
                    // Duration refers to the first object on the resolved timeline
                    return this.lookupReferencedObjsDuration(obj, referencedObjs, allReferences);
                }
                else if (ref === 'start') {
                    return this.lookupReferencedObjs(obj, referencedObjs, allReferences, false, false);
                }
                else if (ref === 'end') {
                    return this.lookupReferencedObjs(obj, referencedObjs, allReferences, true, true);
                }
                else {
                    /* istanbul ignore next */
                    (0, lib_1.assertNever)(ref);
                }
            }
            return { result: [], allReferences: allReferences };
        }
        else if (!expr) {
            return { result: null, allReferences: [] };
        }
        else {
            // expr is an expressionObj
            return this.lookupExpressionObj(obj, context, expr);
        }
    }
    applyParentInstances(parentInstances, value) {
        return this.operateOnArrays(parentInstances, value, this.operateApplyParentInstance);
    }
    /**
     * Perform an action on 2 arrays. Behaves somewhat like the ".*"-operator in Matlab
     * @param array0
     * @param array1
     * @param operate
     */
    operateOnArrays(array0, array1, operate) {
        if (array0 === null || array1 === null)
            return null;
        if ((0, reference_1.isReference)(array0) && (0, reference_1.isReference)(array1)) {
            return operate(array0, array1);
        }
        const result = [];
        const minLength = Math.min((0, lib_1.isArray)(array0) ? array0.length : Infinity, (0, lib_1.isArray)(array1) ? array1.length : Infinity);
        for (let i = 0; i < minLength; i++) {
            const a = (0, lib_1.isArray)(array0)
                ? array0[i]
                : { id: '@', start: array0.value, end: array0.value, references: array0.references };
            const b = (0, lib_1.isArray)(array1)
                ? array1[i]
                : { id: '@', start: array1.value, end: array1.value, references: array1.references };
            const start = a.isFirst
                ? { value: a.start, references: a.references }
                : b.isFirst
                    ? { value: b.start, references: b.references }
                    : operate({ value: a.start, references: (0, reference_1.joinReferences)(a.references, a.id === '@' ? [] : `@${a.id}`) }, { value: b.start, references: (0, reference_1.joinReferences)(b.references, b.id === '@' ? [] : `@${b.id}`) });
            const end = a.isFirst
                ? a.end !== null
                    ? { value: a.end, references: a.references }
                    : null
                : b.isFirst
                    ? b.end !== null
                        ? { value: b.end, references: b.references }
                        : null
                    : operate(a.end !== null
                        ? {
                            value: a.end,
                            references: (0, reference_1.joinReferences)(a.references, a.id === '@' ? [] : `@${a.id}`),
                        }
                        : null, b.end !== null
                        ? {
                            value: b.end,
                            references: (0, reference_1.joinReferences)(b.references, b.id === '@' ? [] : `@${b.id}`),
                        }
                        : null);
            if (start !== null) {
                result.push({
                    id: this.resolvedTimeline.getInstanceId(),
                    start: start.value,
                    end: end === null ? null : end.value,
                    references: (0, reference_1.joinReferences)(start.references, end !== null ? end.references : []),
                    caps: (0, cap_1.joinCaps)(a.caps, b.caps),
                });
            }
        }
        return this.instance.cleanInstances(result, false);
    }
    /**
     * Look up the referenced objects (in the context of a duration-reference)
     */
    lookupReferencedObjsDuration(obj, referencedObjs, allReferences) {
        const instanceDurations = [];
        for (let i = 0; i < referencedObjs.length; i++) {
            const referencedObj = referencedObjs[i];
            // Ensure that the referenced object is resolved.
            // Note: This is where referenced object(s) are recursively resolved
            this.resolvedTimeline.resolveTimelineObj(referencedObj);
            if (referencedObj.resolved.resolvedReferences) {
                if (obj.resolved.isSelfReferencing && referencedObj.resolved.isSelfReferencing) {
                    // If the querying object is self-referencing, exclude any other self-referencing objects,
                    // ignore the object
                }
                else {
                    const firstInstance = referencedObj.resolved.instances[0];
                    if (firstInstance) {
                        const duration = firstInstance.end !== null ? firstInstance.end - firstInstance.start : null;
                        if (duration !== null) {
                            instanceDurations.push({
                                value: duration,
                                references: (0, reference_1.joinReferences)([`#${referencedObj.id}`], firstInstance.references),
                            });
                        }
                    }
                }
            }
        }
        let firstDuration = null;
        for (let i = 0; i < instanceDurations.length; i++) {
            const d = instanceDurations[i];
            if (firstDuration === null || d.value < firstDuration.value)
                firstDuration = d;
        }
        return { result: firstDuration, allReferences: allReferences };
    }
    /**
     * Look up the referenced objects
     */
    lookupReferencedObjs(obj, referencedObjs, allReferences, invert, ignoreFirstIfZero) {
        let referencedInstances = [];
        for (let i = 0; i < referencedObjs.length; i++) {
            const referencedObj = referencedObjs[i];
            // Ensure that the referenced object is resolved.
            // Note: This is where referenced object(s) are recursively resolved
            this.resolvedTimeline.resolveTimelineObj(referencedObj);
            if (referencedObj.resolved.resolvedReferences) {
                if (obj.resolved.isSelfReferencing && referencedObj.resolved.isSelfReferencing) {
                    // If the querying object is self-referencing, exclude any other self-referencing objects,
                    // ignore the object
                }
                else {
                    referencedInstances = referencedInstances.concat(referencedObj.resolved.instances);
                }
            }
        }
        if (referencedInstances.length) {
            if (invert) {
                referencedInstances = this.instance.invertInstances(referencedInstances);
            }
            else {
                referencedInstances = this.instance.cleanInstances(referencedInstances, true, true);
            }
            if (ignoreFirstIfZero) {
                const first = referencedInstances[0];
                if (first && first.start === 0) {
                    referencedInstances.splice(0, 1);
                }
            }
            return { result: referencedInstances, allReferences: allReferences };
        }
        else {
            return { result: [], allReferences: allReferences };
        }
    }
    /**
     * Look up an ExpressionObj
     */
    lookupExpressionObj(obj, context, expr) {
        const l = this.lookupExpression(obj, expr.l, context);
        const r = this.lookupExpression(obj, expr.r, context);
        const lookupExpr = {
            l: l.result,
            o: expr.o,
            r: r.result,
        };
        const allReferences = l.allReferences.concat(r.allReferences);
        if (lookupExpr.o === '!') {
            // Invert, ie discard l, invert and return r:
            if (lookupExpr.r && (0, lib_1.isArray)(lookupExpr.r)) {
                return {
                    result: this.instance.invertInstances(lookupExpr.r),
                    allReferences: allReferences,
                };
            }
            else {
                // We can't invert a value
                return {
                    result: lookupExpr.r,
                    allReferences: allReferences,
                };
            }
        }
        else if (lookupExpr.l === null || lookupExpr.r === null) {
            return { result: null, allReferences: allReferences };
        }
        else if (lookupExpr.o === '&' || lookupExpr.o === '|') {
            const combiner = new ReferenceAndOrCombiner(this.resolvedTimeline, lookupExpr.l, lookupExpr.r, lookupExpr.o);
            const instances = combiner.calculateResult();
            return { result: instances, allReferences: allReferences };
        }
        else {
            const operate = Operators.get(lookupExpr.o);
            const result = this.operateOnArrays(lookupExpr.l, lookupExpr.r, operate);
            return { result: result, allReferences: allReferences };
        }
    }
}
exports.ReferenceHandler = ReferenceHandler;
/** Helper class that deals with an And ('&') or an Or ('|') expression */
class ReferenceAndOrCombiner {
    constructor(resolvedTimeline, leftOperand, rightOperand, operator) {
        this.resolvedTimeline = resolvedTimeline;
        this.leftOperand = leftOperand;
        this.rightOperand = rightOperand;
        this.events = [];
        this.instances = [];
        if (operator === '&') {
            this.calcResult = (left, right) => !!(left && right);
        }
        else if (operator === '|') {
            this.calcResult = (left, right) => !!(left || right);
        }
        else {
            /* istanbul ignore next */
            (0, lib_1.assertNever)(operator);
            /* istanbul ignore next */
            this.calcResult = () => false;
        }
        if ((0, lib_1.isArray)(leftOperand))
            this._addInstanceEvents(leftOperand, true);
        if ((0, lib_1.isArray)(rightOperand))
            this._addInstanceEvents(rightOperand, false);
        this.events = (0, event_1.sortEvents)(this.events);
    }
    _addInstanceEvents(instances, left) {
        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            if (instance.start !== instance.end) {
                // event doesn't actually exist...
                this.events.push({
                    left: left,
                    time: instance.start,
                    value: true,
                    references: [],
                    data: true,
                    instance: instance,
                });
                if (instance.end !== null) {
                    this.events.push({
                        left: left,
                        time: instance.end,
                        value: false,
                        references: [],
                        data: false,
                        instance: instance,
                    });
                }
            }
        }
    }
    calculateResult() {
        let leftValue = (0, reference_1.isReference)(this.leftOperand) ? !!this.leftOperand.value : false;
        let rightValue = (0, reference_1.isReference)(this.rightOperand) ? !!this.rightOperand.value : false;
        let leftInstance = null;
        let rightInstance = null;
        let resultValue = this.calcResult(leftValue, rightValue);
        this.updateInstance(0, resultValue, (0, reference_1.joinReferences)((0, reference_1.isReference)(this.leftOperand) ? this.leftOperand.references : [], (0, reference_1.isReference)(this.rightOperand) ? this.rightOperand.references : []), []);
        for (let i = 0; i < this.events.length; i++) {
            const e = this.events[i];
            const next = this.events[i + 1];
            if (e.left) {
                leftValue = e.value;
                leftInstance = e.instance;
            }
            else {
                rightValue = e.value;
                rightInstance = e.instance;
            }
            if (!next || next.time !== e.time) {
                const newResultValue = this.calcResult(leftValue, rightValue);
                const resultCaps = (leftInstance ? leftInstance.caps ?? [] : []).concat(rightInstance ? rightInstance.caps ?? [] : []);
                if (newResultValue !== resultValue) {
                    this.updateInstance(e.time, newResultValue, (0, reference_1.joinReferences)(leftInstance ? leftInstance.references : [], rightInstance ? rightInstance.references : []), resultCaps);
                    resultValue = newResultValue;
                }
            }
        }
        return this.instances;
    }
    updateInstance(time, value, references, caps) {
        if (value) {
            this.instances.push({
                id: this.resolvedTimeline.getInstanceId(),
                start: time,
                end: null,
                references: references,
                caps: caps,
            });
        }
        else {
            const lastInstance = (0, lib_1.last)(this.instances);
            if (lastInstance) {
                lastInstance.end = time;
                // don't update reference on end
            }
        }
    }
}
/** Helper class for various operators */
class Operators {
    static get(operator) {
        switch (operator) {
            case '+':
                return Operators.Add;
            case '-':
                return Operators.Subtract;
            case '*':
                return Operators.Multiply;
            case '/':
                return Operators.Divide;
            case '%':
                return Operators.Modulo;
            default: {
                (0, lib_1.assertNever)(operator);
                return Operators.Null;
            }
        }
    }
}
Operators.Add = (a, b) => {
    if (a === null || b === null)
        return null;
    return {
        value: a.value + b.value,
        references: (0, reference_1.joinReferences)(a.references, b.references),
    };
};
Operators.Subtract = (a, b) => {
    if (a === null || b === null)
        return null;
    return {
        value: a.value - b.value,
        references: (0, reference_1.joinReferences)(a.references, b.references),
    };
};
Operators.Multiply = (a, b) => {
    if (a === null || b === null)
        return null;
    return {
        value: a.value * b.value,
        references: (0, reference_1.joinReferences)(a.references, b.references),
    };
};
Operators.Divide = (a, b) => {
    if (a === null || b === null)
        return null;
    return {
        value: a.value / b.value,
        references: (0, reference_1.joinReferences)(a.references, b.references),
    };
};
Operators.Modulo = (a, b) => {
    if (a === null || b === null)
        return null;
    return {
        value: a.value % b.value,
        references: (0, reference_1.joinReferences)(a.references, b.references),
    };
};
Operators.Null = () => {
    return null;
};

},{"./lib/cap":24,"./lib/event":25,"./lib/expression":26,"./lib/lib":28,"./lib/reference":30}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolvedTimelineHandler = void 0;
const ExpressionHandler_1 = require("./ExpressionHandler");
const ReferenceHandler_1 = require("./ReferenceHandler");
const lib_1 = require("./lib/lib");
const InstanceHandler_1 = require("./InstanceHandler");
const reference_1 = require("./lib/reference");
const event_1 = require("./lib/event");
const instance_1 = require("./lib/instance");
const timeline_1 = require("./lib/timeline");
const LayerStateHandler_1 = require("./LayerStateHandler");
const expression_1 = require("./lib/expression");
const performance_1 = require("./lib/performance");
const CacheHandler_1 = require("./CacheHandler");
/**
 * A ResolvedTimelineHandler instance is short-lived and used to resolve a timeline.
 * Intended usage:
 * 1. const resolver = new ResolvedTimelineHandler(options)
 * 2. timelineObjects.forEach(obj => resolver.addTimelineObject(obj))
 * 3. resolver.resolveAllTimelineObjs()
 */
class ResolvedTimelineHandler {
    constructor(options) {
        this.options = options;
        /** Maps object id to object */
        this.objectsMap = new Map();
        /** Maps className to a list of object ids  */
        this.classesMap = new Map();
        /** Maps layer to a list of object ids  */
        this.layersMap = new Map();
        /**
         * Maps an array of object ids to an object id (objects that directly reference an reference).
         */
        this.directReferenceMap = new Map();
        /** How many objects that was actually resolved (is affected when using cache) */
        this.statisticResolvingObjectCount = 0;
        /** How many times an object where resolved. (is affected when using cache) */
        this.statisticResolvingCount = 0;
        /**
         * A Map of strings (instance hashes) that is used to determine if an objects instances have changed.
         * Maps objectId -> instancesHash
         */
        this.resolvedObjInstancesHash = new Map();
        /**
         * List of explanations fow why an object changed during a resolve iteration.
         * Used for debugging and Errors
         */
        this.changedObjIdsExplanations = [];
        /**
         * A Map that contains the objects that needs to resolve again.
         * Object are added into this after this.resolveConflictsForLayer()
         */
        this.objectsToReResolve = new Map();
        /** Counter that increases during resolving, for every object that might need re-resolving*/
        this.objectResolveCount = 0;
        /** Error message, is set when an error is encountered and this.options.dontThrowOnError is set */
        this._resolveError = undefined;
        this._idCount = 0;
        this.expression = new ExpressionHandler_1.ExpressionHandler(false, this.options.skipValidation);
        this.instance = new InstanceHandler_1.InstanceHandler(this);
        this.reference = new ReferenceHandler_1.ReferenceHandler(this, this.instance);
        this.debug = this.options.debug ?? false;
    }
    get resolveError() {
        return this._resolveError;
    }
    /** Populate ResolvedTimelineHandler with a timeline-object. */
    addTimelineObject(obj) {
        this._addTimelineObject(obj, 0, undefined, false);
    }
    /** Resolve the timeline. */
    resolveAllTimelineObjs() {
        const toc = (0, performance_1.tic)('  resolveAllTimelineObjs');
        this.debugTrace('=================================== resolveAllTimelineObjs');
        // Step 0: Preparations:
        /** Number of objects in timeline */
        const objectCount = this.objectsMap.size;
        /** Max allowed number of iterations over objects */
        const objectResolveCountMax = objectCount * (this.options.conflictMaxDepth ?? 5);
        /*
            The resolving algorithm basically works like this:

            1a: Resolve all objects
            1b: Resolve conflicts for all layers
                Also determine which objects depend on changed objects due to conflicts

            2: Loop, until there are no more changed objects:
                2a: Resolve objects that depend on changed objects
                2b: Resolve conflicts for affected layers in 2a
                    Also determine which objects depend on changed objects due to conflicts
        */
        // Step 1a: Resolve all objects:
        for (const obj of this.objectsMap.values()) {
            this.resolveTimelineObj(obj);
            // Populate this.resolvedObjInstancesHash now, so that only changes to the timeline instances
            // in this.resolveConflictsForObjs() will be detected later:
            this.resolvedObjInstancesHash.set(obj.id, (0, instance_1.getInstancesHash)(obj.resolved.instances));
        }
        if (this._resolveError)
            return; // Abort on error
        // Step 1b: Resolve conflicts for all objects:
        this.resolveConflictsForObjs(null);
        if (this._resolveError)
            return; // Abort on error
        // Step 2: re-resolve all changed objects, until no more changes are detected:
        while (this.objectsToReResolve.size > 0) {
            if (this.objectResolveCount >= objectResolveCountMax) {
                const error = new Error(`Maximum conflict iteration reached (${this.objectResolveCount}). This is due to a circular dependency in the timeline. Latest changes:\n${this.changedObjIdsExplanations.join('Next iteration -------------------------\n')}`);
                if (this.options.dontThrowOnError) {
                    this._resolveError = error;
                    return;
                }
                else {
                    throw error;
                }
            }
            /* istanbul ignore if */
            if (this.debug) {
                this.debugTrace(`---------------------------------`);
                this.debugTrace(`objectsToReResolve: [${Array.from(this.objectsToReResolve.entries())}]`);
                this.debugTrace(`directReferences: [${Array.from(this.directReferenceMap.entries()).map(([key, value]) => `${key}: [${value}]`)}]`);
            }
            // Collect and reset all objects that depend on previously changed objects
            const conflictObjectsToResolve = [];
            for (const obj of this.objectsToReResolve.values()) {
                this.objectResolveCount++;
                // Force a new resolve, since the referenced objects might have changed (due to conflicts):
                let needsConflictResolve = false;
                if (!obj.resolved.resolvedReferences) {
                    this.resolveTimelineObj(obj);
                    needsConflictResolve = true;
                }
                if (!obj.resolved.resolvedConflicts) {
                    needsConflictResolve = true;
                }
                if (needsConflictResolve) {
                    conflictObjectsToResolve.push(obj);
                }
            }
            if (this._resolveError)
                return; // Abort on error
            // Resolve conflicts for objects that depend on previously changed objects:
            this.resolveConflictsForObjs(conflictObjectsToResolve);
        }
        toc();
    }
    /**
     * Resolve a timeline-object.
     * The Resolve algorithm works like this:
     * 1. Go through the .enable expression(s) and look up all referenced objects.
     * 	  1.5 For each referenced object, recursively resolve it first if not already resolved.
     * 2. Collect the resolved instances and calculate the resulting list of resulting instances.
     */
    resolveTimelineObj(obj) {
        if (obj.resolved.resolving) {
            // Circular dependency
            const error = Error(`Circular dependency when trying to resolve "${obj.id}"`);
            if (this.options.dontThrowOnError) {
                this._resolveError = error;
                obj.resolved.firstResolved = true;
                obj.resolved.resolvedReferences = true;
                obj.resolved.resolving = false;
                obj.resolved.instances = [];
                return;
            }
            else {
                throw error;
            }
        }
        if (obj.resolved.resolvedReferences)
            return; // already resolved
        const toc = (0, performance_1.tic)('     resolveTimelineObj');
        obj.resolved.resolving = true;
        this.statisticResolvingCount++;
        if (!obj.resolved.firstResolved) {
            this.statisticResolvingObjectCount++;
        }
        this.debugTrace(`============ resolving "${obj.id}"`);
        const directReferences = [];
        let resultingInstances = [];
        if (obj.disabled) {
            resultingInstances = [];
        }
        else {
            // Loop up references to the parent:
            let parentInstances = null;
            let hasParent = false;
            let parentRef = undefined;
            if (obj.resolved.parentId) {
                hasParent = true;
                parentRef = `#${obj.resolved.parentId}`;
                const parentLookup = this.reference.lookupExpression(obj, this.expression.interpretExpression(parentRef), 'start');
                // pushToArray(directReferences, parentLookup.allReferences)
                parentInstances = parentLookup.result; // a start-reference will always return an array, or null
                if (parentInstances !== null) {
                    // Ensure that the parentInstances references the parent:
                    for (const parentInstance of parentInstances) {
                        parentInstance.references = (0, reference_1.joinReferences)(parentInstance.references, parentRef);
                    }
                }
            }
            const enables = (0, lib_1.ensureArray)(obj.enable);
            for (let i = 0; i < enables.length; i++) {
                const enable = enables[i];
                // Resolve the the enable.repeating expression:
                const lookupRepeating = enable.repeating !== undefined
                    ? this.lookupExpression(obj, directReferences, enable.repeating, 'duration')
                    : { result: null };
                let lookedupRepeating;
                if (lookupRepeating.result === null) {
                    // Do nothing
                    lookedupRepeating = null;
                }
                else if ((0, lib_1.isArray)(lookupRepeating.result)) {
                    if (lookupRepeating.result.length === 0) {
                        lookedupRepeating = null;
                    }
                    else if (lookupRepeating.result.length === 1) {
                        lookedupRepeating = (0, lib_1.literal)({
                            value: lookupRepeating.result[0].start,
                            references: lookupRepeating.result[0].references,
                        });
                    }
                    else {
                        // The lookup for repeating returned multiple instances.
                        // Not supported at the moment, perhaps this could be supported in the future.
                        /* istanbul ignore next */
                        throw new Error(`lookupExpression should never return an array for .duration lookup`);
                    }
                }
                else {
                    lookedupRepeating = lookupRepeating.result;
                }
                /** Array of instances this enable-expression resulted in */
                let enableInstances;
                if (enable.while !== undefined) {
                    const whileExpr = 
                    // Handle special case "1", 1:
                    enable.while === '1' || enable.while === 1
                        ? 'true'
                        : // Handle special case "0", 0:
                            enable.while === '0' || enable.while === 0
                                ? 'false'
                                : enable.while;
                    // Note: a lookup for 'while' works the same as for 'start'
                    const lookupWhile = this.lookupExpression(obj, directReferences, whileExpr, 'start');
                    if (lookupWhile.result === null) {
                        // Do nothing
                        enableInstances = [];
                    }
                    else if ((0, lib_1.isArray)(lookupWhile.result)) {
                        enableInstances = lookupWhile.result;
                    }
                    else if (lookupWhile.result !== null) {
                        enableInstances = [
                            {
                                id: this.getInstanceId(),
                                start: lookupWhile.result.value,
                                end: null,
                                references: lookupWhile.result.references,
                            },
                        ];
                    }
                    else {
                        enableInstances = [];
                    }
                }
                else if (enable.start !== undefined) {
                    const lookupStart = this.lookupExpression(obj, directReferences, enable.start, 'start');
                    const lookedupStarts = lookupStart.refersToParent
                        ? this.reference.applyParentInstances(parentInstances, lookupStart.result)
                        : lookupStart.result;
                    const events = [];
                    // const endEvents: EventForInstance[] = []
                    let iStart = 0;
                    let iEnd = 0;
                    if (lookedupStarts === null) {
                        // Do nothing
                    }
                    else if ((0, lib_1.isArray)(lookedupStarts)) {
                        // Use the start-times of the instances and add them to the list of events:
                        // (The end-times are irrelevant)
                        for (let i = 0; i < lookedupStarts.length; i++) {
                            const instance = lookedupStarts[i];
                            const eventId = `${obj.id}_${iStart++}`;
                            events.push({
                                time: instance.start,
                                value: true,
                                data: { instance: instance, id: eventId },
                                references: instance.references,
                            });
                        }
                    }
                    else {
                        events.push({
                            time: lookedupStarts.value,
                            value: true,
                            data: {
                                instance: {
                                    id: this.getInstanceId(),
                                    start: lookedupStarts.value,
                                    end: null,
                                    references: lookedupStarts.references,
                                },
                                id: `${obj.id}_${iStart++}`,
                            },
                            references: lookedupStarts.references,
                        });
                    }
                    if (enable.end !== undefined) {
                        const lookupEnd = this.lookupExpression(obj, directReferences, enable.end, 'end');
                        /** Contains an inverted list of instances. Therefore .start means an end */
                        const lookedupEnds = !lookupEnd
                            ? null
                            : lookupEnd.refersToParent
                                ? this.reference.applyParentInstances(parentInstances, lookupEnd.result)
                                : lookupEnd.result;
                        if (lookedupEnds === null) {
                            // Do nothing
                        }
                        else if ((0, lib_1.isArray)(lookedupEnds)) {
                            // Use the start-times of the instances and add them (as end-events) to the list:
                            // (The end-times are irrelevant)
                            for (let i = 0; i < lookedupEnds.length; i++) {
                                const instance = lookedupEnds[i];
                                events.push({
                                    time: instance.start,
                                    value: false,
                                    data: { instance: instance, id: `${obj.id}_${iEnd++}` },
                                    references: instance.references,
                                });
                            }
                        }
                        else if (lookedupEnds) {
                            events.push({
                                time: lookedupEnds.value,
                                value: false,
                                data: {
                                    instance: {
                                        id: this.getInstanceId(),
                                        start: lookedupEnds.value,
                                        end: null,
                                        references: lookedupEnds.references,
                                    },
                                    id: `${obj.id}_${iEnd++}`,
                                },
                                references: lookedupEnds.references,
                            });
                        }
                    }
                    else if (enable.duration !== undefined) {
                        const lookupDuration = this.lookupExpression(obj, directReferences, enable.duration, 'duration');
                        let lookedupDuration = lookupDuration.result;
                        if (lookedupDuration === null) {
                            // Do nothing
                        }
                        else if ((0, lib_1.isArray)(lookedupDuration)) {
                            if (lookedupDuration.length === 1) {
                                lookedupDuration = (0, lib_1.literal)({
                                    value: lookedupDuration[0].start,
                                    references: lookedupDuration[0].references,
                                });
                            }
                            else if (lookedupDuration.length === 0) {
                                lookedupDuration = null;
                            }
                            else {
                                // Lookup rendeded multiple durations.
                                // This is unsupported at the moment, but could possibly be added in the future.
                                /* istanbul ignore next */
                                throw new Error(`lookedupDuration should never return an array for .duration lookup`);
                            }
                        }
                        if (lookedupDuration !== null) {
                            if (lookedupRepeating !== null && lookedupDuration.value > lookedupRepeating.value) {
                                // Cap duration to repeating duration
                                lookedupDuration.value = lookedupRepeating.value;
                            }
                            // Go through all pre-existing start-events, and add end-events for each of them.
                            for (let i = 0; i < events.length; i++) {
                                const startEvent = events[i];
                                if (startEvent.value) {
                                    // Is a start-event
                                    const time = startEvent.time + lookedupDuration.value;
                                    const references = (0, reference_1.joinReferences)(startEvent.references, lookedupDuration.references);
                                    events.push({
                                        time: time,
                                        value: false,
                                        data: {
                                            id: startEvent.data.id,
                                            instance: {
                                                id: startEvent.data.instance.id,
                                                start: time,
                                                end: null,
                                                references: references,
                                            },
                                        },
                                        references: references,
                                    });
                                }
                            }
                        }
                    }
                    enableInstances = this.instance.convertEventsToInstances(events, false, false, 
                    // Omit the referenced originalStart/End when using enable.start:
                    true);
                    // Cap those instances to the parent instances:
                    if (parentRef && parentInstances !== null) {
                        const parentInstanceMap = new Map();
                        for (const instance of parentInstances) {
                            parentInstanceMap.set(instance.id, instance);
                        }
                        const cappedEnableInstances = [];
                        for (const instance of enableInstances) {
                            let matchedParentInstance = undefined;
                            // Go through the references in reverse, because sometimes there are multiple matches, and the last one is probably the one we want to use.
                            for (let i = instance.references.length - 1; i >= 0; i--) {
                                const ref = instance.references[i];
                                if ((0, reference_1.isInstanceReference)(ref)) {
                                    matchedParentInstance = parentInstanceMap.get((0, reference_1.getRefInstanceId)(ref));
                                    if (matchedParentInstance)
                                        break;
                                }
                            }
                            if (matchedParentInstance) {
                                const cappedInstance = this.instance.capInstance(instance, matchedParentInstance);
                                if (!cappedInstance.caps)
                                    cappedInstance.caps = [];
                                cappedInstance.caps.push((0, lib_1.literal)({
                                    id: matchedParentInstance.id,
                                    start: matchedParentInstance.start,
                                    end: matchedParentInstance.end,
                                }));
                                cappedEnableInstances.push(cappedInstance);
                            }
                            else {
                                cappedEnableInstances.push(instance);
                            }
                        }
                        enableInstances = cappedEnableInstances;
                    }
                }
                else {
                    enableInstances = [];
                }
                enableInstances = this.instance.applyRepeatingInstances(enableInstances, lookedupRepeating);
                // Add the instances resulting from this enable-expression to the list:
                (0, lib_1.pushToArray)(resultingInstances, enableInstances);
            }
            // Cap the instances to the parent instances:
            if (hasParent) {
                resultingInstances = this.capInstancesToParentInstances({
                    instances: resultingInstances,
                    parentInstances,
                });
            }
        }
        // Make the instance ids unique:
        const idSet = new Set();
        for (const instance of resultingInstances) {
            if (idSet.has(instance.id)) {
                instance.id = `${instance.id}_${this.getInstanceId()}`;
            }
            idSet.add(instance.id);
        }
        if (obj.seamless && resultingInstances.length > 1) {
            resultingInstances = this.instance.cleanInstances(resultingInstances, true, false);
        }
        if (obj.resolved.parentId) {
            directReferences.push(`#${obj.resolved.parentId}`);
        }
        if (!obj.resolved.firstResolved) {
            // This only needs to be done upon first resolve:
            this.updateDirectReferenceMap(obj, directReferences);
        }
        obj.resolved.firstResolved = true;
        obj.resolved.resolvedReferences = true;
        obj.resolved.resolving = false;
        obj.resolved.instances = resultingInstances;
        if (this.debug) {
            this.debugTrace(`directReferences "${obj.id}": ${JSON.stringify(directReferences)}`);
            this.debugTrace(`resolved "${obj.id}": ${JSON.stringify(obj.resolved.instances)}`);
        }
        // Finally:
        obj.resolved.resolving = false;
        toc();
    }
    getStatistics() {
        const toc = (0, performance_1.tic)('  getStatistics');
        if (this.options.skipStatistics) {
            return {
                totalCount: 0,
                resolvedInstanceCount: 0,
                resolvedObjectCount: 0,
                resolvedGroupCount: 0,
                resolvedKeyframeCount: 0,
                resolvingObjectCount: 0,
                resolvingCount: 0,
            };
        }
        const statistics = {
            totalCount: 0,
            resolvedInstanceCount: 0,
            resolvedObjectCount: 0,
            resolvedGroupCount: 0,
            resolvedKeyframeCount: 0,
            resolvingObjectCount: this.statisticResolvingObjectCount,
            resolvingCount: this.statisticResolvingCount,
        };
        for (const obj of this.objectsMap.values()) {
            statistics.totalCount += 1;
            if (obj.isGroup) {
                statistics.resolvedGroupCount += 1;
            }
            if (obj.resolved.isKeyframe) {
                statistics.resolvedKeyframeCount += 1;
            }
            else {
                statistics.resolvedObjectCount += 1;
            }
            statistics.resolvedInstanceCount += obj.resolved.instances.length;
        }
        toc();
        return statistics;
    }
    initializeCache(cacheObj) {
        this.cache = new CacheHandler_1.CacheHandler(cacheObj, this);
        return this.cache;
    }
    /**
     * Returns an object.
     * type-wise, assumes you know what object you're looking for
     */
    getObject(objId) {
        return this.objectsMap.get(objId);
    }
    /**
     * Returns object ids on a layer
     * type-wise, assumes you know what layer you're looking for
     */
    getLayerObjects(layer) {
        return this.layersMap.get(layer);
    }
    /**
     * Returns object ids on a layer
     * type-wise, assumes you know what className you're looking for
     */
    getClassObjects(className) {
        return this.classesMap.get(className);
    }
    capInstancesToParentInstances(arg) {
        if (!arg.parentInstances)
            return [];
        const events = [];
        for (const instance of arg.instances) {
            events.push({
                time: instance.start,
                value: true,
                references: instance.references,
                data: { instance, isParent: false },
            });
            if (instance.end !== null) {
                events.push({
                    time: instance.end,
                    value: false,
                    references: instance.references,
                    data: { instance, isParent: false },
                });
            }
        }
        for (const instance of arg.parentInstances) {
            events.push({
                time: instance.start,
                value: true,
                references: instance.references,
                data: { instance, isParent: true },
            });
            if (instance.end !== null) {
                events.push({
                    time: instance.end,
                    value: false,
                    references: instance.references,
                    data: { instance, isParent: true },
                });
            }
        }
        (0, event_1.sortEvents)(events, compareEvents);
        const parentActiveInstances = [];
        const childActiveInstances = [];
        let currentActive = undefined;
        const cappedInstances = [];
        function finalizeCurrentActive() {
            if (currentActive) {
                cappedInstances.push(currentActive.instance);
                currentActive = undefined;
            }
        }
        for (const event of events) {
            if (event.data.isParent) {
                // Parent instance
                if (event.value) {
                    parentActiveInstances.push(event.data.instance);
                }
                else {
                    (0, instance_1.spliceInstances)(parentActiveInstances, (i) => (i === event.data.instance ? undefined : i));
                }
            }
            else {
                // Child instance
                if (event.value) {
                    childActiveInstances.push(event.data.instance);
                }
                else {
                    (0, instance_1.spliceInstances)(childActiveInstances, (i) => (i === event.data.instance ? undefined : i));
                }
            }
            const childInstance = childActiveInstances[childActiveInstances.length - 1];
            const parentInstance = parentActiveInstances[parentActiveInstances.length - 1];
            /** If there is an active child instance */
            const toBeEnabled = Boolean(childInstance && parentInstance);
            if (toBeEnabled) {
                if (currentActive) {
                    if (
                    // Check if instance is still the same:
                    childInstance.id !== currentActive.instance.id ||
                        (parentInstance !== currentActive.parent &&
                            // Check if parent still is active:
                            !parentActiveInstances.includes(currentActive.parent))) {
                        // parent isn't active anymore, stop and start a new instance:
                        // Stop instance:
                        currentActive.instance.end = event.time;
                        currentActive.instance.originalEnd = currentActive.instance.originalEnd ?? event.time;
                        currentActive.instance.references = (0, reference_1.joinReferences)(currentActive.instance.references, event.data.instance.references);
                        finalizeCurrentActive();
                    }
                    else {
                        // Continue an active instance
                        if (currentActive.instance.id !== childInstance.id) {
                            currentActive.instance.references = (0, reference_1.joinReferences)(currentActive.instance.references, childInstance.references);
                        }
                    }
                }
                if (!currentActive) {
                    // Start a new instance:
                    currentActive = {
                        instance: {
                            ...childInstance,
                            start: event.time,
                            end: null,
                            // originalStart: childInstance.originalStart ?? event.time,
                            // originalEnd: childInstance.originalEnd ?? null, // set later
                            originalStart: childInstance.originalStart ?? childInstance.start,
                            originalEnd: childInstance.originalEnd ?? childInstance.end ?? null,
                            references: (0, reference_1.joinReferences)(childInstance.references, ...parentActiveInstances.map((i) => i.references)),
                        },
                        parent: parentInstance,
                    };
                }
            }
            else {
                if (currentActive) {
                    // Stop instance:
                    currentActive.instance.end = event.time;
                    currentActive.instance.originalEnd = currentActive.instance.originalEnd ?? event.time;
                    currentActive.instance.references = (0, reference_1.joinReferences)(currentActive.instance.references, event.data.instance.references);
                    finalizeCurrentActive();
                }
            }
        }
        finalizeCurrentActive();
        return cappedInstances;
    }
    updateDirectReferenceMap(obj, directReferences) {
        obj.resolved.directReferences = directReferences;
        for (const ref of directReferences) {
            const objectsThisIsReferencing = [];
            if ((0, reference_1.isObjectReference)(ref)) {
                const objId = (0, reference_1.getRefObjectId)(ref);
                objectsThisIsReferencing.push(objId);
            }
            else if ((0, reference_1.isClassReference)(ref)) {
                const className = (0, reference_1.getRefClass)(ref);
                for (const objId of this.getClassObjects(className) ?? []) {
                    objectsThisIsReferencing.push(objId);
                }
            }
            else if ((0, reference_1.isLayerReference)(ref)) {
                const layer = (0, reference_1.getRefLayer)(ref);
                for (const objId of this.getLayerObjects(layer) ?? []) {
                    objectsThisIsReferencing.push(objId);
                }
            }
            else if (
            /* istanbul ignore next */
            (0, reference_1.isInstanceReference)(ref)) {
                // do nothing
            }
            else {
                /* istanbul ignore next */
                (0, lib_1.assertNever)(ref);
            }
            for (const refObjId of objectsThisIsReferencing) {
                let refs = this.directReferenceMap.get(refObjId);
                if (!refs) {
                    refs = [];
                    this.directReferenceMap.set(refObjId, refs);
                }
                refs.push(obj.id);
            }
        }
    }
    getObjectsLayers(objs) {
        const layers = new Set();
        for (const obj of objs) {
            if ((0, timeline_1.objHasLayer)(obj)) {
                layers.add(`${obj.layer}`);
            }
        }
        return Array.from(layers.values());
    }
    /** Returns a list of all object's layers */
    getAllObjectLayers() {
        if (!this.allObjectLayersCache) {
            // Cache this, since this won't change:
            this.allObjectLayersCache = this.getObjectsLayers(this.objectsMap.values());
        }
        return this.allObjectLayersCache;
    }
    /** Look up an expression, update references and return it. */
    lookupExpression(obj, directReferences, expr, context) {
        const simplifiedExpression = this.expression.simplifyExpression(expr);
        const lookupResult = this.reference.lookupExpression(obj, simplifiedExpression, context);
        (0, lib_1.pushToArray)(directReferences, lookupResult.allReferences);
        // If expression is a constant, it is assumed to be a time relative to its parent:
        const refersToParent = obj.resolved.parentId && (0, expression_1.isConstantExpr)(simplifiedExpression);
        return {
            allReferences: lookupResult.allReferences,
            result: lookupResult.result,
            refersToParent,
        };
    }
    _addTimelineObject(obj, 
    /** A number that increases the more levels inside of a group the objects is. 0 = no parent */
    levelDeep, 
    /** ID of the parent object */
    parentId, isKeyframe) {
        const toc = (0, performance_1.tic)('  addTimelineObject');
        // Is it already added?
        if (!this.options.skipValidation) {
            if (this.objectsMap.has(obj.id)) {
                /* istanbul ignore next */
                throw Error(`All timelineObjects must be unique! (duplicate: "${obj.id}")`);
            }
        }
        // Add the object:
        {
            const o = {
                ...obj,
                resolved: {
                    firstResolved: false,
                    resolvedReferences: false,
                    resolvedConflicts: false,
                    resolving: false,
                    instances: [],
                    levelDeep: levelDeep,
                    isSelfReferencing: false,
                    directReferences: [],
                    parentId: parentId,
                    isKeyframe: isKeyframe,
                },
            };
            this.objectsMap.set(obj.id, o);
            if (obj.classes) {
                for (let i = 0; i < obj.classes.length; i++) {
                    const className = obj.classes[i];
                    if (className) {
                        let classList = this.classesMap.get(className);
                        if (!classList) {
                            classList = [];
                            this.classesMap.set(className, classList);
                        }
                        classList.push(obj.id);
                    }
                }
            }
            if ((0, timeline_1.objHasLayer)(obj)) {
                const layer = `${obj.layer}`;
                let layerList = this.layersMap.get(layer);
                if (!layerList) {
                    layerList = [];
                    this.layersMap.set(layer, layerList);
                }
                layerList.push(obj.id);
            }
        }
        // Go through children and keyframes:
        {
            // Add children:
            if (obj.isGroup && obj.children) {
                for (let i = 0; i < obj.children.length; i++) {
                    const child = obj.children[i];
                    this._addTimelineObject(child, levelDeep + 1, obj.id, false);
                }
            }
            // Add keyframes:
            if (obj.keyframes) {
                for (let i = 0; i < obj.keyframes.length; i++) {
                    const keyframe = obj.keyframes[i];
                    const kf2 = {
                        ...keyframe,
                        layer: '',
                    };
                    this._addTimelineObject(kf2, levelDeep + 1, obj.id, true);
                }
            }
        }
        toc();
    }
    /**
     * Resolve conflicts for all layers of the provided objects
     */
    resolveConflictsForObjs(
    /** null means all layers */
    objs) {
        const toc = (0, performance_1.tic)('     resolveConflictsForObjs');
        // These need to be cleared,
        // as they are populated during the this.updateObjectsToReResolve() below:
        this.changedObjIdsExplanations = [];
        this.objectsToReResolve.clear();
        /** List of layers to resolve conflicts on */
        let layers;
        if (objs === null) {
            layers = this.getAllObjectLayers();
        }
        else {
            layers = this.getObjectsLayers(objs);
        }
        for (const layer of layers) {
            const maybeChangedObjs = this.resolveConflictsForLayer(layer);
            // run this.updateObjectsToReResolve() here (as opposed to outside the loop),
            // to allow for a fast-path in resolveConflictsForLayer that skips resolving that layer if it contains
            // objects that depend on already changed objects.
            this.updateObjectsToReResolve(maybeChangedObjs);
        }
        toc();
    }
    /**
     * Resolve conflicts for a layer
     * @returns A list of objects on that layer
     */
    resolveConflictsForLayer(layer) {
        const handler = new LayerStateHandler_1.LayerStateHandler(this, this.instance, layer);
        // Fast path: If an object on this layer depends on an already changed object we should skip this layer, this iteration.
        // Because the objects will likely change during the next resolve-iteration anyway.
        for (const objId of handler.objectIdsOnLayer) {
            if (this.objectsToReResolve.has(objId)) {
                this.debugTrace(`optimization: Skipping "${layer}" since "${objId}" changed`);
                return [];
            }
        }
        handler.resolveConflicts();
        return handler.objectsOnLayer;
    }
    /** Returns the next unique instance id */
    getInstanceId() {
        return `@${(this._idCount++).toString(36)}`;
    }
    updateObjectsToReResolve(maybeChangedObjs) {
        const toc = (0, performance_1.tic)('     updateObjectsToReResolve');
        const changedObjs = new Set();
        for (const obj of maybeChangedObjs) {
            // Check if the instances have changed:
            const instancesHash = (0, instance_1.getInstancesHash)(obj.resolved.instances);
            const prevHash = this.resolvedObjInstancesHash.get(obj.id) ?? 'not-found';
            if (instancesHash !== prevHash) {
                this.changedObjIdsExplanations.push(`"${obj.id}" changed from: \n   ${prevHash}\n   , to \n   ${instancesHash}\n`);
                if (this.changedObjIdsExplanations.length > 2)
                    this.changedObjIdsExplanations.shift();
                this.debugTrace(`changed: ${obj.id}: "${prevHash}" -> "${instancesHash}"`);
                changedObjs.add(obj.id);
                this.resolvedObjInstancesHash.set(obj.id, instancesHash);
            }
        }
        for (const changedObjId of changedObjs.values()) {
            // Find all objects that depend on this:
            const directReferences = this.directReferenceMap.get(changedObjId) ?? [];
            for (const objId of directReferences) {
                const obj = this.getObject(objId);
                obj.resolved.resolvedReferences = false;
                // Note: obj.resolved.resolvedConflicts will be set to false later when resolving references
                this.objectsToReResolve.set(obj.id, obj);
            }
        }
        toc();
    }
    debugTrace(...args) {
        if (this.debug)
            console.log(...args);
    }
}
exports.ResolvedTimelineHandler = ResolvedTimelineHandler;
function compareEvents(a, b) {
    // start event be first:
    const aValue = a.value;
    const bValue = b.value;
    if (aValue && !bValue)
        return -1;
    if (!aValue && bValue)
        return 1;
    const aIsParent = a.data.isParent;
    const bIsParent = b.data.isParent;
    if (aValue) {
        // start: parents first:
        if (aIsParent && !bIsParent)
            return -1;
        if (!aIsParent && bIsParent)
            return 1;
    }
    else {
        // end: parents last:
        if (aIsParent && !bIsParent)
            return 1;
        if (!aIsParent && bIsParent)
            return -1;
    }
    // parents first:
    // if (a.data.isParent && !b.data.isParent) return -1
    // if (!a.data.isParent && b.data.isParent) return 1
    return 0;
}

},{"./CacheHandler":14,"./ExpressionHandler":15,"./InstanceHandler":16,"./LayerStateHandler":17,"./ReferenceHandler":18,"./lib/event":25,"./lib/expression":26,"./lib/instance":27,"./lib/lib":28,"./lib/performance":29,"./lib/reference":30,"./lib/timeline":31}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolverHandler = void 0;
const ResolvedTimelineHandler_1 = require("./ResolvedTimelineHandler");
const resolvedTimeline_1 = require("../api/resolvedTimeline");
const lib_1 = require("./lib/lib");
const performance_1 = require("./lib/performance");
const timeline_1 = require("./lib/timeline");
const TimelineValidator_1 = require("./TimelineValidator");
/**
 * Note: A Resolver instance is short-lived and used to resolve a timeline.
 * Intended usage:
 * 1. const resolver = new Resolver(options)
 * 2. resolver.run(timeline)
 */
class ResolverHandler {
    constructor(options) {
        this.options = options;
        this.hasRun = false;
        this.nextEvents = [];
        const toc = (0, performance_1.tic)('new Resolver');
        this.resolvedTimeline = new ResolvedTimelineHandler_1.ResolvedTimelineHandler(this.options);
        this.validator = new TimelineValidator_1.TimelineValidator();
        toc();
    }
    /**
     * Resolves a timeline, i.e. resolves the references between objects
     * This method can only be run once per Resolver instance.
     */
    resolveTimeline(timeline) {
        const toc = (0, performance_1.tic)('resolveTimeline');
        /* istanbul ignore if */
        if (this.hasRun)
            throw new Error(`Resolver.resolveTimeline can only run once per instance!
Usage:
const resolver = new Resolver(options);
resolver.run(timeline);`);
        this.hasRun = true;
        // Step 0: Validate the timeline:
        if (!this.options.skipValidation) {
            this.validator.validateTimeline(timeline, false);
        }
        // Step 1: Populate ResolvedTimeline with the timeline:
        for (const obj of timeline) {
            this.resolvedTimeline.addTimelineObject(obj);
        }
        // Step 2: Use cache:
        let cacheHandler;
        if (this.options.cache) {
            cacheHandler = this.resolvedTimeline.initializeCache(this.options.cache);
            cacheHandler.determineChangedObjects();
        }
        // Step 3: Go through and resolve all objects:
        this.resolvedTimeline.resolveAllTimelineObjs();
        // Step 4: Populate nextEvents:
        this.updateNextEvents();
        // Step 5: persist cache
        if (cacheHandler) {
            cacheHandler.persistData();
        }
        const resolvedTimeline = (0, lib_1.literal)({
            objects: (0, lib_1.mapToObject)(this.resolvedTimeline.objectsMap),
            classes: (0, lib_1.mapToObject)(this.resolvedTimeline.classesMap),
            layers: (0, lib_1.mapToObject)(this.resolvedTimeline.layersMap),
            nextEvents: this.nextEvents,
            statistics: this.resolvedTimeline.getStatistics(),
            error: this.resolvedTimeline.resolveError,
        });
        toc();
        return resolvedTimeline;
    }
    /** Update this.nextEvents */
    updateNextEvents() {
        const toc = (0, performance_1.tic)('  updateNextEvents');
        this.nextEvents = [];
        const allObjects = [];
        const allKeyframes = [];
        for (const obj of this.resolvedTimeline.objectsMap.values()) {
            if (obj.resolved.isKeyframe) {
                allKeyframes.push(obj);
            }
            else {
                allObjects.push(obj);
            }
        }
        /** Used to fast-track in cases where there are no keyframes */
        const hasKeyframes = allKeyframes.length > 0;
        const objectInstanceStartTimes = new Set();
        const objectInstanceEndTimes = new Set();
        // Go through keyframes last:
        for (const obj of [...allObjects, ...allKeyframes]) {
            if (!obj.resolved.isKeyframe) {
                if (!(0, timeline_1.objHasLayer)(obj))
                    continue; // transparent objects are omitted in NextEvents
            }
            else if (obj.resolved.parentId !== undefined) {
                const parentObj = this.resolvedTimeline.getObject(obj.resolved.parentId);
                if (parentObj) {
                    /* istanbul ignore if */
                    if (!(0, timeline_1.objHasLayer)(parentObj))
                        continue; // Keyframes of transparent objects are omitted in NextEvents
                }
            }
            for (let i = 0; i < obj.resolved.instances.length; i++) {
                const instance = obj.resolved.instances[i];
                if (instance.start > this.options.time && instance.start < (this.options.limitTime ?? Infinity)) {
                    let useThis = true;
                    if (hasKeyframes) {
                        if (!obj.resolved.isKeyframe) {
                            objectInstanceStartTimes.add(`${obj.id}_${instance.start}`);
                        }
                        else {
                            // No need to put keyframe event if its parent starts at the same time:
                            if (objectInstanceStartTimes.has(`${obj.resolved.parentId}_${instance.start}`)) {
                                useThis = false;
                            }
                        }
                    }
                    if (useThis) {
                        this.nextEvents.push({
                            objId: obj.id,
                            type: obj.resolved.isKeyframe ? resolvedTimeline_1.EventType.KEYFRAME : resolvedTimeline_1.EventType.START,
                            time: instance.start,
                        });
                    }
                }
                if (instance.end !== null &&
                    instance.end > this.options.time &&
                    instance.end < (this.options.limitTime ?? Infinity)) {
                    let useThis = true;
                    if (hasKeyframes) {
                        if (!obj.resolved.isKeyframe) {
                            objectInstanceEndTimes.add(`${obj.id}_${instance.end}`);
                        }
                        else {
                            // No need to put keyframe event if its parent ends at the same time:
                            if (objectInstanceEndTimes.has(`${obj.resolved.parentId}_${instance.end}`)) {
                                useThis = false;
                            }
                        }
                    }
                    if (useThis) {
                        this.nextEvents.push({
                            objId: obj.id,
                            type: obj.resolved.isKeyframe ? resolvedTimeline_1.EventType.KEYFRAME : resolvedTimeline_1.EventType.END,
                            time: instance.end,
                        });
                    }
                }
            }
        }
        this.nextEvents.sort(compareNextEvents);
        toc();
    }
}
exports.ResolverHandler = ResolverHandler;
function compareNextEvents(a, b) {
    return a.time - b.time || b.type - a.type || (0, lib_1.compareStrings)(a.objId, b.objId);
}

},{"../api/resolvedTimeline":8,"./ResolvedTimelineHandler":19,"./TimelineValidator":22,"./lib/lib":28,"./lib/performance":29,"./lib/timeline":31}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateHandler = void 0;
const instance_1 = require("./lib/instance");
const lib_1 = require("./lib/lib");
const performance_1 = require("./lib/performance");
const timeline_1 = require("./lib/timeline");
class StateHandler {
    getState(resolvedTimeline, time, eventLimit = 0) {
        const toc = (0, performance_1.tic)('getState');
        const state = {
            time: time,
            layers: {},
            nextEvents: resolvedTimeline.nextEvents.filter((e) => e.time > time),
        };
        if (eventLimit)
            state.nextEvents = state.nextEvents.slice(0, eventLimit);
        for (const obj of Object.values(resolvedTimeline.objects)) {
            if (!(0, timeline_1.objHasLayer)(obj))
                continue;
            // Note: We can assume that it is not a keyframe here, because keyframes don't have layers
            for (const instance of obj.resolved.instances) {
                if ((0, instance_1.instanceIsActive)(instance, time)) {
                    let contentIsOriginal = true;
                    const objInstance = {
                        ...obj,
                        instance,
                    };
                    /* istanbul ignore if */
                    if (state.layers[`${obj.layer}`]) {
                        // There is already an object on this layer!
                        console.error(state.layers[`${obj.layer}`]);
                        console.error(objInstance);
                        throw new Error(`Internal Error: There is already an object on layer "${obj.layer}"!`);
                    }
                    state.layers[`${obj.layer}`] = objInstance;
                    // Now, apply keyframes:
                    const objectKeyframes = obj.keyframes
                        ? obj.keyframes.map((kf) => resolvedTimeline.objects[kf.id])
                        : [];
                    for (const keyframe of this.getActiveKeyframeInstances(objectKeyframes, time)) {
                        if (contentIsOriginal) {
                            // We don't want to modify the original content, so we deep-clone it before modifying it:
                            objInstance.content = (0, lib_1.clone)(obj.content);
                            contentIsOriginal = false;
                        }
                        StateHandler.applyKeyframeContent(objInstance.content, keyframe.content);
                    }
                }
            }
        }
        toc();
        return state;
    }
    /**
     * Apply keyframe content onto its parent content.
     * The keyframe content is deeply-applied onto the parent content.
     */
    static applyKeyframeContent(parentContent, keyframeContent) {
        const toc = (0, performance_1.tic)('  applyKeyframeContent');
        for (const [attr, value] of Object.entries(keyframeContent)) {
            if ((0, lib_1.isObject)(value)) {
                if ((0, lib_1.isArray)(value)) {
                    // Value is an array
                    if (!Array.isArray(parentContent[attr]))
                        parentContent[attr] = [];
                    this.applyKeyframeContent(parentContent[attr], value);
                    parentContent[attr].splice(value.length, Infinity);
                }
                else {
                    // Value is an object
                    if (!(0, lib_1.isObject)(parentContent[attr]) || Array.isArray(parentContent[attr]))
                        parentContent[attr] = {};
                    this.applyKeyframeContent(parentContent[attr], value);
                }
            }
            else {
                parentContent[attr] = value;
            }
        }
        toc();
    }
    getActiveKeyframeInstances(keyframes, time) {
        const keyframeInstances = [];
        for (const keyframe of keyframes) {
            for (const instance of keyframe.resolved.instances) {
                if ((0, instance_1.instanceIsActive)(instance, time)) {
                    keyframeInstances.push({
                        ...keyframe,
                        instance,
                    });
                }
            }
        }
        keyframeInstances.sort((a, b) => {
            // Highest priority is applied last:
            const aPriority = a.priority ?? 0;
            const bPriority = b.priority ?? 0;
            if (aPriority < bPriority)
                return -1;
            if (aPriority > bPriority)
                return 1;
            // Last start time is applied last:
            if (a.instance.start < b.instance.start)
                return -1;
            if (a.instance.start > b.instance.start)
                return 1;
            /* istanbul ignore next */
            return 0;
        });
        return keyframeInstances;
    }
}
exports.StateHandler = StateHandler;

},{"./lib/instance":27,"./lib/lib":28,"./lib/performance":29,"./lib/timeline":31}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineValidator = void 0;
const ExpressionHandler_1 = require("./ExpressionHandler");
const lib_1 = require("./lib/lib");
const performance_1 = require("./lib/performance");
/** These characters are reserved and cannot be used in ids, etc */
const RESERVED_CHARACTERS = /[#.$]/g;
/** These characters are reserved for possible future use and cannot be used in ids, etc */
const FUTURE_RESERVED_CHARACTERS = /[=?@{}[\]^§]/g;
/**
 * Note: A TimelineValidator instance is short-lived and used to validate a timeline.
 * Intended usage:
 * 1. const validator = new TimelineValidator()
 * 2. validator.validateTimeline(timeline)
 * or:
 * 1. const validator = new TimelineValidator()
 * 2. validator.validateObject(obj)
 * or:
 * 1. const validator = new TimelineValidator()
 * 2. validator.validateKeyframe(obj)
 */
class TimelineValidator {
    constructor() {
        this.uniqueIds = {};
    }
    /** Validates all objects in the timeline. Throws an error if something's wrong. */
    validateTimeline(
    /** The timeline to validate */
    timeline, 
    /** Set to true to enable some optional strict rules. Set this to true to increase future compatibility. */
    strict) {
        const toc = (0, performance_1.tic)('  validateTimeline');
        for (let i = 0; i < timeline.length; i++) {
            const obj = timeline[i];
            this.validateObject(obj, strict);
        }
        toc();
    }
    /** Validates a simgle Timeline-object. Throws an error if something's wrong. */
    validateObject(
    /** The object to validate */
    obj, 
    /** Set to true to enable some optional strict rules. Set this to true to increase future compatibility. */
    strict) {
        if (!obj)
            throw new Error(`Object is undefined`);
        if (typeof obj !== 'object')
            throw new Error(`Object is not an object`);
        try {
            this.validateId(obj, strict);
            this.validateLayer(obj, strict);
            this.validateContent(obj);
            this.validateEnable(obj, strict);
            if (obj.keyframes) {
                for (let i = 0; i < obj.keyframes.length; i++) {
                    const keyframe = obj.keyframes[i];
                    try {
                        this.validateKeyframe(keyframe, strict);
                    }
                    catch (e) {
                        throw new Error(`Keyframe[${i}]: ${e}`);
                    }
                }
            }
            this.validateClasses(obj, strict);
            if (obj.children && !obj.isGroup)
                throw new Error(`Attribute "children" is set but "isGroup" is not`);
            if (obj.isGroup && !obj.children)
                throw new Error(`Attribute "isGroup" is set but "children" missing`);
            if (obj.children) {
                for (let i = 0; i < obj.children.length; i++) {
                    const child = obj.children[i];
                    try {
                        this.validateObject(child, strict);
                    }
                    catch (e) {
                        throw new Error(`Child[${i}]: ${e}`);
                    }
                }
            }
            if (obj.priority !== undefined && typeof obj.priority !== 'number')
                throw new Error(`Attribute "priority" is not a number`);
        }
        catch (err) {
            if (err instanceof Error) {
                const err2 = new Error(`Object "${obj.id}": ${err.message}`);
                err2.stack = err.stack;
                throw err;
            }
            else
                throw err;
        }
    }
    /** Validates a simgle Timeline-object. Throws an error if something's wrong. */
    validateKeyframe(
    /** The object to validate */
    keyframe, 
    /** Set to true to enable some optional strict rules. Set this to true to increase future compatibility */
    strict) {
        if (!keyframe)
            throw new Error(`Keyframe is undefined`);
        if (typeof keyframe !== 'object')
            throw new Error(`Keyframe is not an object`);
        try {
            this.validateId(keyframe, strict);
            this.validateContent(keyframe);
            this.validateEnable(keyframe, strict);
            this.validateClasses(keyframe, strict);
        }
        catch (err) {
            if (err instanceof Error) {
                const err2 = new Error(`Keyframe "${keyframe.id}": ${err.message}`);
                err2.stack = err.stack;
                throw err;
            }
            else
                throw err;
        }
    }
    validateId(obj, strict) {
        if (!obj.id)
            throw new Error(`Object missing "id" attribute`);
        if (typeof obj.id !== 'string')
            throw new Error(`Object "id" attribute is not a string: "${obj.id}"`);
        try {
            TimelineValidator.validateReferenceString(obj.id, strict);
        }
        catch (err) {
            throw new Error(`Object "id" attribute: ${err}`);
        }
        if (this.uniqueIds[obj.id])
            throw new Error(`id "${obj.id}" is not unique`);
        this.uniqueIds[obj.id] = true;
    }
    validateLayer(obj, strict) {
        if (obj.layer === undefined)
            throw new Error(`"layer" attribute is undefined. (If an object is to have no layer, set this to an empty string.)`);
        try {
            TimelineValidator.validateReferenceString(`${obj.layer}`, strict);
        }
        catch (err) {
            throw new Error(`"layer" attribute: ${err}`);
        }
    }
    validateContent(obj) {
        if (!obj.content)
            throw new Error(`"content" attribute must be set`);
    }
    validateEnable(obj, strict) {
        if (!obj.enable)
            throw new Error(`"enable" attribute must be set`);
        const enables = (0, lib_1.ensureArray)(obj.enable);
        for (let i = 0; i < enables.length; i++) {
            const enable = enables[i];
            if (enable.start !== undefined) {
                if (strict && enable.while !== undefined)
                    throw new Error(`"enable.start" and "enable.while" cannot be combined`);
                if (strict && enable.end !== undefined && enable.duration !== undefined)
                    throw new Error(`"enable.end" and "enable.duration" cannot be combined`);
            }
            else if (enable.while !== undefined) {
                if (strict && enable.end !== undefined)
                    throw new Error(`"enable.while" and "enable.end" cannot be combined`);
                if (strict && enable.duration !== undefined)
                    throw new Error(`"enable.while" and "enable.duration" cannot be combined`);
            }
            else
                throw new Error(`"enable.start" or "enable.while" must be set`);
        }
    }
    validateClasses(obj, strict) {
        if (obj.classes) {
            for (let i = 0; i < obj.classes.length; i++) {
                const className = obj.classes[i];
                if (className && typeof className !== 'string')
                    throw new Error(`"classes[${i}]" is not a string`);
                try {
                    TimelineValidator.validateReferenceString(className, strict);
                }
                catch (err) {
                    throw new Error(` "classes[${i}]": ${err}`);
                }
            }
        }
    }
    /**
     * Validates a string that is used in Timeline as a reference (an id, a class or layer)
     * @param str The string to validate
     * @param strict Set to true to enable some strict rules (rules that can possibly be ignored)
     */
    static validateReferenceString(str, strict) {
        if (!str)
            return;
        const matchesOperators = ExpressionHandler_1.REGEXP_OPERATORS.test(str);
        const matchesReserved = RESERVED_CHARACTERS.test(str);
        const matchesFutureReserved = strict && FUTURE_RESERVED_CHARACTERS.test(str);
        if (matchesOperators || matchesReserved || matchesFutureReserved) {
            const matchOperators = str.match(ExpressionHandler_1.REGEXP_OPERATORS) ?? [];
            const matchReserved = str.match(RESERVED_CHARACTERS) ?? [];
            const matchFutureReserved = (strict && str.match(FUTURE_RESERVED_CHARACTERS)) || [];
            throw new Error(`The string "${str}" contains characters which aren't allowed in Timeline: ${[
                matchOperators.length > 0 && `${matchOperators.map((o) => `"${o}"`).join(', ')} (is an operator)`,
                matchReserved.length > 0 &&
                    `${matchReserved.map((o) => `"${o}"`).join(', ')} (is a reserved character)`,
                matchFutureReserved.length > 0 &&
                    `${matchFutureReserved
                        .map((o) => `"${o}"`)
                        .join(', ')} (is a strict reserved character and might be used in the future)`,
            ]
                .filter(Boolean)
                .join(', ')}`);
        }
    }
}
exports.TimelineValidator = TimelineValidator;

},{"./ExpressionHandler":15,"./lib/lib":28,"./lib/performance":29}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
class Cache {
    constructor(autoCleanup = false) {
        this.autoCleanup = autoCleanup;
        this.cache = new Map();
        this.clearTimeout = undefined;
        this.timeToCueNewCleanup = false;
        if (this.autoCleanup)
            this.timeToCueNewCleanup = true;
    }
    /** Cache the result of function for a limited time */
    cacheResult(key, fcn, limitTime) {
        const cache = this.cache.get(key);
        if (!cache || cache.ttl < Date.now()) {
            const value = fcn();
            this.cache.set(key, {
                ttl: Date.now() + limitTime,
                value: value,
            });
            if (this.timeToCueNewCleanup) {
                this.timeToCueNewCleanup = false;
                /* istanbul ignore next */
                this.clearTimeout = setTimeout(() => {
                    this.clearTimeout = undefined;
                    this.timeToCueNewCleanup = true;
                    this.cleanUp();
                }, limitTime + 100);
            }
            return value;
        }
        else {
            return cache.value;
        }
    }
    /* istanbul ignore next */
    cleanUp() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (value.ttl < now)
                this.cache.delete(key);
        }
    }
    clear() {
        this.cache.clear();
        if (this.clearTimeout) {
            clearTimeout(this.clearTimeout);
            this.clearTimeout = undefined;
            this.timeToCueNewCleanup = true;
        }
    }
}
exports.Cache = Cache;

},{}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCapsToResuming = exports.joinCaps = void 0;
function joinCaps(...caps) {
    const capMap = {};
    for (let i = 0; i < caps.length; i++) {
        const caps2 = caps[i];
        if (caps2) {
            for (let j = 0; j < caps2.length; j++) {
                const cap2 = caps2[j];
                capMap[cap2.id] = cap2;
            }
        }
    }
    return Object.values(capMap);
}
exports.joinCaps = joinCaps;
function addCapsToResuming(instance, ...caps) {
    const capsToAdd = [];
    const joinedCaps = joinCaps(...caps);
    for (let i = 0; i < joinedCaps.length; i++) {
        const cap = joinedCaps[i];
        if (cap.end !== null && instance.end !== null && cap.end > instance.end) {
            capsToAdd.push({
                id: cap.id,
                start: 0,
                end: cap.end,
            });
        }
    }
    instance.caps = joinCaps(instance.caps, capsToAdd);
}
exports.addCapsToResuming = addCapsToResuming;

},{}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortEvents = void 0;
function sortEvents(events, additionalSortFcnBefore) {
    return events.sort((a, b) => {
        if (a.time > b.time)
            return 1;
        if (a.time < b.time)
            return -1;
        const result = additionalSortFcnBefore ? additionalSortFcnBefore(a, b) : 0;
        if (result !== 0)
            return result;
        const aId = a.data && (a.data.id || a.data.instance?.id);
        const bId = b.data && (b.data.id || b.data.instance?.id);
        if (aId && bId && aId === bId) {
            // If the events refer to the same instance id, let the start event be first,
            // to handle zero-length instances.
            if (a.value && !b.value)
                return -1;
            if (!a.value && b.value)
                return 1;
        }
        else {
            // ends events first:
            if (a.value && !b.value)
                return 1;
            if (!a.value && b.value)
                return -1;
        }
        return 0;
    });
}
exports.sortEvents = sortEvents;

},{}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNumericExpr = exports.isConstantExpr = void 0;
/** Returns true if an expression is a constant (ie doesn't reference something else) */
function isConstantExpr(str) {
    if (isNumericExpr(str))
        return true;
    if (typeof str === 'string') {
        const lStr = str.toLowerCase();
        if (lStr === 'true')
            return true;
        if (lStr === 'false')
            return true;
    }
    return false;
}
exports.isConstantExpr = isConstantExpr;
function isNumericExpr(str) {
    if (str === null)
        return false;
    if (typeof str === 'number')
        return true;
    if (typeof str === 'string')
        return !!/^[-+]?[0-9.]+$/.exec(str) && !isNaN(parseFloat(str));
    return false;
}
exports.isNumericExpr = isNumericExpr;

},{}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstanceHash = exports.getInstancesHash = exports.baseInstance = exports.baseInstances = exports.spliceInstances = exports.getInstanceIntersection = exports.instanceIsActive = exports.isInstanceId = void 0;
const lib_1 = require("./lib");
function isInstanceId(str) {
    return str.startsWith('@');
}
exports.isInstanceId = isInstanceId;
function instanceIsActive(instance, time) {
    return instance.start <= time && (instance.end ?? Infinity) > time;
}
exports.instanceIsActive = instanceIsActive;
/**
 * Returns the intersection of two instances.
 * Example: for (10-20) and (15-30), the intersection is (15-20).
 */
function getInstanceIntersection(a, b) {
    if (a.start < (b.end ?? Infinity) && (a.end ?? Infinity) > b.start) {
        const start = Math.max(a.start, b.start);
        const end = Math.min(a.end ?? Infinity, b.end ?? Infinity);
        return {
            start,
            end: end === Infinity ? null : end,
        };
    }
    return null;
}
exports.getInstanceIntersection = getInstanceIntersection;
/**
 * Convenience function to splice an array of instances
 * @param instances The array of instances to splice
 * @param fcn Operator function.
 *   Is called for each instance in the array,
 *   and should return an instance (or an array of instances) to insert in place of the original instance,
 *   or undefined to remove the instance.
 *   (To leave the instance unchanged, return the original instance)
 */
function spliceInstances(instances, fcn) {
    for (let i = 0; i < instances.length; i++) {
        const fcnResult = fcn(instances[i]);
        const insertInstances = fcnResult === undefined ? [] : (0, lib_1.ensureArray)(fcnResult);
        if (insertInstances.length === 0) {
            instances.splice(i, 1);
            i--;
        }
        else {
            if (insertInstances[0] === instances[i])
                continue;
            // replace:
            instances.splice(i, 1, ...insertInstances);
            i += insertInstances.length - 1;
        }
    }
}
exports.spliceInstances = spliceInstances;
function baseInstances(instances) {
    return instances.map((instance) => baseInstance(instance));
}
exports.baseInstances = baseInstances;
function baseInstance(instance) {
    return {
        start: instance.start,
        end: instance.end,
    };
}
exports.baseInstance = baseInstance;
/** Returns a string hash that changes whenever any instance has changed in a significant way */
function getInstancesHash(instances) {
    const strs = [];
    for (const instance of instances) {
        strs.push(getInstanceHash(instance));
    }
    return strs.join(',');
}
exports.getInstancesHash = getInstancesHash;
/** Returns a string hash that changes whenever an instance has changed in a significant way */
function getInstanceHash(instance) {
    const orgStart = instance.originalStart ?? instance.start;
    const orgEnd = instance.originalEnd ?? instance.end;
    return `${instance.start}_${instance.end ?? 'null'}(${orgStart}_${orgEnd ?? 'null'})`;
}
exports.getInstanceHash = getInstanceHash;

},{"./lib":28}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareStrings = exports.mapToObject = exports.assertNever = exports.isArray = exports.ensureArray = exports.isEmpty = exports.sortBy = exports.omit = exports.uniq = exports.clone = exports.pushToArray = exports.reduceObj = exports.isObject = exports.last = exports.compact = exports.literal = void 0;
function literal(o) {
    return o;
}
exports.literal = literal;
function compact(arr) {
    const returnValues = [];
    for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (!!v || (v !== undefined && v !== null && v !== ''))
            returnValues.push(v);
    }
    return returnValues;
}
exports.compact = compact;
function last(arr) {
    return arr[arr.length - 1];
}
exports.last = last;
/** Returns true if argument is an object (or an array, but NOT null) */
function isObject(o) {
    return o !== null && typeof o === 'object';
}
exports.isObject = isObject;
function reduceObj(objs, fcn, initialValue) {
    return Object.entries(objs).reduce((memo, [key, value], index) => {
        return fcn(memo, value, key, index);
    }, initialValue);
}
exports.reduceObj = reduceObj;
/**
 * Concatenate two arrays of values.
 * This is a convenience function used to ensure that the two arrays are of the same type.
 * @param arr0 The array of values to push into
 * @param arr1 An array of values to push into arr0
 */
function pushToArray(arr0, arr1) {
    for (const item of arr1) {
        arr0.push(item);
    }
}
exports.pushToArray = pushToArray;
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
exports.clone = clone;
function uniq(arr) {
    return Array.from(new Set(arr));
}
exports.uniq = uniq;
function omit(obj, ...keys) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (keys.some((k) => (Array.isArray(k) ? k.includes(key) : k === key)))
            continue;
        result[key] = value;
    }
    return result;
}
exports.omit = omit;
function sortBy(arr, fcn) {
    const sortArray = arr.map((item) => ({ item, value: fcn(item) }));
    sortArray.sort((a, b) => {
        if (a.value < b.value)
            return -1;
        if (a.value > b.value)
            return 1;
        return 0;
    });
    return sortArray.map((item) => item.item);
}
exports.sortBy = sortBy;
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}
exports.isEmpty = isEmpty;
function ensureArray(value) {
    return Array.isArray(value) ? value : [value];
}
exports.ensureArray = ensureArray;
/**
 * Slightly faster than Array.isArray().
 * Note: Ensure that the value provided is not null!
 */
function isArray(arg) {
    // Fast-path optimization: checking for .length is faster than Array.isArray()
    return arg.length !== undefined && Array.isArray(arg);
}
exports.isArray = isArray;
/**
 * Helper function to simply assert that the value is of the type never.
 * Usage: at the end of if/else or switch, to ensure that there is no fallthrough.
 */
function assertNever(_value) {
    // does nothing
}
exports.assertNever = assertNever;
function mapToObject(map) {
    const o = {};
    for (const [key, value] of map.entries()) {
        o[key] = value;
    }
    return o;
}
exports.mapToObject = mapToObject;
function compareStrings(a, b) {
    return a > b ? 1 : a < b ? -1 : 0;
}
exports.compareStrings = compareStrings;

},{}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticTocPrint = exports.tic = exports.activatePerformanceDebugging = void 0;
const perf_hooks_1 = require("perf_hooks");
let durations = {};
let callCounts = {};
let firstStartTime = 0;
let active = false;
function activatePerformanceDebugging(activate) {
    active = activate;
}
exports.activatePerformanceDebugging = activatePerformanceDebugging;
function noop() {
    // nothing
}
/**
 * Used to measure performance.
 * Starts a measurement, returns a function that should be called when the measurement is done.
 */
function tic(id) {
    if (!active)
        return noop;
    if (!firstStartTime)
        firstStartTime = perf_hooks_1.performance.now();
    if (!durations[id])
        durations[id] = 0;
    if (!callCounts[id])
        callCounts[id] = 0;
    const startTime = perf_hooks_1.performance.now();
    return () => {
        const duration = perf_hooks_1.performance.now() - startTime;
        durations[id] = durations[id] + duration;
        callCounts[id]++;
    };
}
exports.tic = tic;
function ticTocPrint() {
    if (!active)
        return;
    const totalDuration = perf_hooks_1.performance.now() - firstStartTime;
    const maxKeyLength = Math.max(...Object.keys(durations).map((k) => k.length));
    console.log('ticTocPrint\n' +
        padStr(`Total duration `, maxKeyLength + 2) +
        `${Math.floor(totalDuration)}\n` +
        Object.entries(durations)
            .map((d) => {
            let str = padStr(`${d[0]} `, maxKeyLength + 2);
            str += padStr(`${Math.floor(d[1] * 10) / 10}`, 8);
            str += padStr(`${Math.floor((d[1] / totalDuration) * 1000) / 10}%`, 7);
            str += `${callCounts[d[0]]}`;
            return str;
        })
            .join('\n'));
    durations = {};
    callCounts = {};
}
exports.ticTocPrint = ticTocPrint;
function padStr(str, length) {
    while (str.length < length)
        str += ' ';
    return str;
}

},{"perf_hooks":3}],30:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReference = exports.joinReferences = exports.getRefInstanceId = exports.isInstanceReference = exports.getRefLayer = exports.isLayerReference = exports.getRefClass = exports.isClassReference = exports.getRefObjectId = exports.isObjectReference = void 0;
const lib_1 = require("./lib");
const performance_1 = require("./performance");
/*
 * References are strings that are added to instances,
 * to indicate what objects, layers or classes they are derived from.
 */
function isObjectReference(ref) {
    return ref.startsWith('#');
}
exports.isObjectReference = isObjectReference;
function getRefObjectId(ref) {
    return ref.slice(1);
}
exports.getRefObjectId = getRefObjectId;
function isClassReference(ref) {
    return ref.startsWith('.');
}
exports.isClassReference = isClassReference;
function getRefClass(ref) {
    return ref.slice(1);
}
exports.getRefClass = getRefClass;
function isLayerReference(ref) {
    return ref.startsWith('$');
}
exports.isLayerReference = isLayerReference;
function getRefLayer(ref) {
    return ref.slice(1);
}
exports.getRefLayer = getRefLayer;
function isInstanceReference(ref) {
    return ref.startsWith('@');
}
exports.isInstanceReference = isInstanceReference;
function getRefInstanceId(ref) {
    return ref.slice(1);
}
exports.getRefInstanceId = getRefInstanceId;
/** Add / join references Arrays. Returns a sorted list of unique references */
function joinReferences(references, ...addReferences) {
    const toc = (0, performance_1.tic)('     joinReferences');
    // Fast path: When nothing is added, return the original references:
    if (addReferences.length === 1 && typeof addReferences[0] !== 'string' && addReferences[0].length === 0) {
        return [...references];
    }
    let fastPath = false;
    let resultingRefs = [];
    // Fast path: When a single ref is added
    if (addReferences.length === 1 && typeof addReferences[0] === 'string') {
        if (references.includes(addReferences[0])) {
            // The value already exists, return the original references:
            return [...references];
        }
        else {
            // just quickly add the reference and jump forward to sorting of resultingRefs:
            resultingRefs = [...references];
            resultingRefs.push(addReferences[0]);
            fastPath = true;
        }
    }
    if (!fastPath) {
        const refSet = new Set();
        for (const ref of references) {
            if (!refSet.has(ref)) {
                refSet.add(ref);
                resultingRefs.push(ref);
            }
        }
        for (const addReference of addReferences) {
            if (typeof addReference === 'string') {
                if (!refSet.has(addReference)) {
                    refSet.add(addReference);
                    resultingRefs.push(addReference);
                }
            }
            else {
                for (const ref of addReference) {
                    if (!refSet.has(ref)) {
                        refSet.add(ref);
                        resultingRefs.push(ref);
                    }
                }
            }
        }
    }
    resultingRefs.sort(lib_1.compareStrings);
    toc();
    return resultingRefs;
}
exports.joinReferences = joinReferences;
function isReference(ref) {
    return ref !== null && typeof ref.value === 'number';
}
exports.isReference = isReference;

},{"./lib":28,"./performance":29}],31:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.objHasLayer = void 0;
/**
 * Returns true if object has a layer.
 * Note: Objects without a layer are called "transparent objects",
 * and won't be present in the resolved state.
 */
function objHasLayer(obj) {
    return obj.layer !== undefined && obj.layer !== '' && obj.layer !== null;
}
exports.objHasLayer = objHasLayer;

},{}],32:[function(require,module,exports){
(function (global){(function (){
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global global, define, Symbol, Reflect, Promise, SuppressedError */
var __extends;
var __assign;
var __rest;
var __decorate;
var __param;
var __esDecorate;
var __runInitializers;
var __propKey;
var __setFunctionName;
var __metadata;
var __awaiter;
var __generator;
var __exportStar;
var __values;
var __read;
var __spread;
var __spreadArrays;
var __spreadArray;
var __await;
var __asyncGenerator;
var __asyncDelegator;
var __asyncValues;
var __makeTemplateObject;
var __importStar;
var __importDefault;
var __classPrivateFieldGet;
var __classPrivateFieldSet;
var __classPrivateFieldIn;
var __createBinding;
var __addDisposableResource;
var __disposeResources;
(function (factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : {};
    if (typeof define === "function" && define.amd) {
        define("tslib", ["exports"], function (exports) { factory(createExporter(root, createExporter(exports))); });
    }
    else if (typeof module === "object" && typeof module.exports === "object") {
        factory(createExporter(root, createExporter(module.exports)));
    }
    else {
        factory(createExporter(root));
    }
    function createExporter(exports, previous) {
        if (exports !== root) {
            if (typeof Object.create === "function") {
                Object.defineProperty(exports, "__esModule", { value: true });
            }
            else {
                exports.__esModule = true;
            }
        }
        return function (id, v) { return exports[id] = previous ? previous(id, v) : v; };
    }
})
(function (exporter) {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };

    __extends = function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };

    __assign = Object.assign || function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };

    __rest = function (s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    };

    __decorate = function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };

    __param = function (paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    };

    __esDecorate = function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
        function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
        var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
        var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
        var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
        var _, done = false;
        for (var i = decorators.length - 1; i >= 0; i--) {
            var context = {};
            for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
            for (var p in contextIn.access) context.access[p] = contextIn.access[p];
            context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
            var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
            if (kind === "accessor") {
                if (result === void 0) continue;
                if (result === null || typeof result !== "object") throw new TypeError("Object expected");
                if (_ = accept(result.get)) descriptor.get = _;
                if (_ = accept(result.set)) descriptor.set = _;
                if (_ = accept(result.init)) initializers.unshift(_);
            }
            else if (_ = accept(result)) {
                if (kind === "field") initializers.unshift(_);
                else descriptor[key] = _;
            }
        }
        if (target) Object.defineProperty(target, contextIn.name, descriptor);
        done = true;
    };

    __runInitializers = function (thisArg, initializers, value) {
        var useValue = arguments.length > 2;
        for (var i = 0; i < initializers.length; i++) {
            value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
        }
        return useValue ? value : void 0;
    };

    __propKey = function (x) {
        return typeof x === "symbol" ? x : "".concat(x);
    };

    __setFunctionName = function (f, name, prefix) {
        if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
        return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
    };

    __metadata = function (metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    };

    __awaiter = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };

    __generator = function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (g && (g = 0, op[0] && (_ = 0)), _) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };

    __exportStar = function(m, o) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
    };

    __createBinding = Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
            desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    });

    __values = function (o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };

    __read = function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };

    /** @deprecated */
    __spread = function () {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    };

    /** @deprecated */
    __spreadArrays = function () {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    };

    __spreadArray = function (to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    };

    __await = function (v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    };

    __asyncGenerator = function (thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    };

    __asyncDelegator = function (o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
    };

    __asyncValues = function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    };

    __makeTemplateObject = function (cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    };

    var __setModuleDefault = Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
        o["default"] = v;
    };

    __importStar = function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };

    __importDefault = function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };

    __classPrivateFieldGet = function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };

    __classPrivateFieldSet = function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };

    __classPrivateFieldIn = function (state, receiver) {
        if (receiver === null || (typeof receiver !== "object" && typeof receiver !== "function")) throw new TypeError("Cannot use 'in' operator on non-object");
        return typeof state === "function" ? receiver === state : state.has(receiver);
    };

    __addDisposableResource = function (env, value, async) {
        if (value !== null && value !== void 0) {
            if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
            var dispose;
            if (async) {
                if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
                dispose = value[Symbol.asyncDispose];
            }
            if (dispose === void 0) {
                if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
                dispose = value[Symbol.dispose];
            }
            if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
            env.stack.push({ value: value, dispose: dispose, async: async });
        }
        else if (async) {
            env.stack.push({ async: true });
        }
        return value;
    };

    var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    __disposeResources = function (env) {
        function fail(e) {
            env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        function next() {
            while (env.stack.length) {
                var rec = env.stack.pop();
                try {
                    var result = rec.dispose && rec.dispose.call(rec.value);
                    if (rec.async) return Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                }
                catch (e) {
                    fail(e);
                }
            }
            if (env.hasError) throw env.error;
        }
        return next();
    };

    exporter("__extends", __extends);
    exporter("__assign", __assign);
    exporter("__rest", __rest);
    exporter("__decorate", __decorate);
    exporter("__param", __param);
    exporter("__esDecorate", __esDecorate);
    exporter("__runInitializers", __runInitializers);
    exporter("__propKey", __propKey);
    exporter("__setFunctionName", __setFunctionName);
    exporter("__metadata", __metadata);
    exporter("__awaiter", __awaiter);
    exporter("__generator", __generator);
    exporter("__exportStar", __exportStar);
    exporter("__createBinding", __createBinding);
    exporter("__values", __values);
    exporter("__read", __read);
    exporter("__spread", __spread);
    exporter("__spreadArrays", __spreadArrays);
    exporter("__spreadArray", __spreadArray);
    exporter("__await", __await);
    exporter("__asyncGenerator", __asyncGenerator);
    exporter("__asyncDelegator", __asyncDelegator);
    exporter("__asyncValues", __asyncValues);
    exporter("__makeTemplateObject", __makeTemplateObject);
    exporter("__importStar", __importStar);
    exporter("__importDefault", __importDefault);
    exporter("__classPrivateFieldGet", __classPrivateFieldGet);
    exporter("__classPrivateFieldSet", __classPrivateFieldSet);
    exporter("__classPrivateFieldIn", __classPrivateFieldIn);
    exporter("__addDisposableResource", __addDisposableResource);
    exporter("__disposeResources", __disposeResources);
});

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],33:[function(require,module,exports){
(function (global){(function (){
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

/* global global, define, System, Reflect, Promise */
var __extends;
var __assign;
var __rest;
var __decorate;
var __param;
var __metadata;
var __awaiter;
var __generator;
var __exportStar;
var __values;
var __read;
var __spread;
var __spreadArrays;
var __await;
var __asyncGenerator;
var __asyncDelegator;
var __asyncValues;
var __makeTemplateObject;
var __importStar;
var __importDefault;
var __classPrivateFieldGet;
var __classPrivateFieldSet;
var __createBinding;
(function (factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : {};
    if (typeof define === "function" && define.amd) {
        define("tslib", ["exports"], function (exports) { factory(createExporter(root, createExporter(exports))); });
    }
    else if (typeof module === "object" && typeof module.exports === "object") {
        factory(createExporter(root, createExporter(module.exports)));
    }
    else {
        factory(createExporter(root));
    }
    function createExporter(exports, previous) {
        if (exports !== root) {
            if (typeof Object.create === "function") {
                Object.defineProperty(exports, "__esModule", { value: true });
            }
            else {
                exports.__esModule = true;
            }
        }
        return function (id, v) { return exports[id] = previous ? previous(id, v) : v; };
    }
})
(function (exporter) {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };

    __extends = function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };

    __assign = Object.assign || function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };

    __rest = function (s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    };

    __decorate = function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };

    __param = function (paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    };

    __metadata = function (metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    };

    __awaiter = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };

    __generator = function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };

    __createBinding = function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    };

    __exportStar = function (m, exports) {
        for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) exports[p] = m[p];
    };

    __values = function (o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };

    __read = function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };

    __spread = function () {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    };

    __spreadArrays = function () {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    };

    __await = function (v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    };

    __asyncGenerator = function (thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    };

    __asyncDelegator = function (o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    };

    __asyncValues = function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    };

    __makeTemplateObject = function (cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    };

    __importStar = function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result["default"] = mod;
        return result;
    };

    __importDefault = function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };

    __classPrivateFieldGet = function (receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to get private field on non-instance");
        }
        return privateMap.get(receiver);
    };

    __classPrivateFieldSet = function (receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to set private field on non-instance");
        }
        privateMap.set(receiver, value);
        return value;
    };

    exporter("__extends", __extends);
    exporter("__assign", __assign);
    exporter("__rest", __rest);
    exporter("__decorate", __decorate);
    exporter("__param", __param);
    exporter("__metadata", __metadata);
    exporter("__awaiter", __awaiter);
    exporter("__generator", __generator);
    exporter("__exportStar", __exportStar);
    exporter("__createBinding", __createBinding);
    exporter("__values", __values);
    exporter("__read", __read);
    exporter("__spread", __spread);
    exporter("__spreadArrays", __spreadArrays);
    exporter("__await", __await);
    exporter("__asyncGenerator", __asyncGenerator);
    exporter("__asyncDelegator", __asyncDelegator);
    exporter("__asyncValues", __asyncValues);
    exporter("__makeTemplateObject", __makeTemplateObject);
    exporter("__importStar", __importStar);
    exporter("__importDefault", __importDefault);
    exporter("__classPrivateFieldGet", __classPrivateFieldGet);
    exporter("__classPrivateFieldSet", __classPrivateFieldSet);
});

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])(1)
});

//# sourceMappingURL=timeline-visualizer.js.map
