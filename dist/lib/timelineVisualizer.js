"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isEqual = require("lodash.isequal");
const merge = require("lodash.merge");
const superfly_timeline_1 = require("superfly-timeline");
const events_1 = require("events");
/** Step size/ time step. */
const DEFAULT_STEP_SIZE = 1;
/** Draw range (will be multiplied by DEFAULT_STEP_SIZE). */
const DEFAULT_DRAW_RANGE = 500;
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
        /** @private @readonly Default time range to display. */
        this._defaultDrawRange = DEFAULT_DRAW_RANGE * this.stepSize;
        // Layers on timeline.
        this._layerLabels = {};
        // State of the timeline.
        this._timelineState = {};
        // Map of objects for determining hovered object
        this._hoveredObjectMap = {};
        // Start and end time of the current view. Defines the objects within view on the timeline.
        this._drawTimeStart = 0;
        // Store whether the mouse is held down, for scrolling.
        this._mouseDown = false;
        // Current zoom amount.
        this._timelineZoom = DEFAULT_ZOOM_VALUE;
        // Whether or not the playhead should move.
        this._playHeadPlaying = false;
        // Speed of the playhead [units / second]
        this._playSpeed = DEFAULT_PLAYHEAD_SPEED;
        // The current time position of the playhead.
        this._playHeadTime = 0;
        // The last time updateDraw() did a draw.
        this._updateDrawLastTime = 0;
        // Whether the mouse last moved over an object or out.
        this._lastHoverAction = MOUSEOUT;
        // Name of object that was last hovered over.
        this._lastHoveredName = '';
        // Initialise other values.
        this._canvasId = canvasId;
        this.initCanvas();
        this._drawPlayhead = !!options.drawPlayhead;
        // Calculate width of label column.
        this._layerLabelWidth = this._canvasWidth * this._layerLabelWidthProportionOfCanvas;
        // Calculate timeline width and start point.
        this._timelineWidth = this._canvasWidth - this._layerLabelWidth;
        this._timelineStart = this._layerLabelWidth;
        // Put playhead at timeline start.
        this._playHeadPosition = this._timelineStart;
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
        if (this._resolvedStates === undefined) {
            // Resolve timeline.
            const resolvedTimeline = superfly_timeline_1.Resolver.resolveTimeline(timeline, options);
            this._resolvedStates = superfly_timeline_1.Resolver.resolveAllStates(resolvedTimeline);
            // Set time range.
            this._drawTimeRange = this._defaultDrawRange;
            // Set timeline start and end times.
            if (options.time !== undefined) {
                this._drawTimeStart = options.time;
            }
            // Set the end time.
            this._drawTimeEnd = this._drawTimeStart + this._defaultDrawRange;
            // Move playhead to start time.
            this._playHeadTime = this._drawTimeStart;
        }
        else {
            // If the playhead is being drawn, the resolve time should be at the playhead time.
            if (this._drawPlayhead) {
                options.time = this._playHeadTime;
            }
            // Resolve the timeline.
            const resolvedTimeline = superfly_timeline_1.Resolver.resolveTimeline(timeline, options);
            const newResolvedStates = superfly_timeline_1.Resolver.resolveAllStates(resolvedTimeline);
            if (this._drawPlayhead) {
                // Trim the current timeline:
                if (newResolvedStates) {
                    this._resolvedStates = this.trimTimeline(this._resolvedStates, { end: this._playHeadTime });
                    // Merge the timelines.
                    this._resolvedStates = this.mergeTimelineObjects(this._resolvedStates, newResolvedStates);
                }
            }
            else {
                // Otherwise we only see one timeline at a time.
                // Overwrite the previous timeline:
                this._resolvedStates = newResolvedStates;
            }
        }
        // Update layers.
        this.updateLayerLabels();
        // Calculate new zoom values.
        this.updateScaledDrawTimeRange();
        // Redraw the timeline.
        this.redrawTimeline();
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
            this.updateScaledDrawTimeRange();
            this._drawTimeEnd = this._timelineStart + this._scaledDrawTimeRange;
            changed = true;
        }
        // If timestamp has been specified.
        if (viewPort.timestamp !== undefined) {
            // Set start time to specified time.
            if (viewPort.timestamp > 0) {
                this._drawTimeStart = viewPort.timestamp;
                this._drawTimeEnd = this._drawTimeStart + this._scaledDrawTimeRange;
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
            changed = true;
        }
        // Redraw timeline if anything has changed.
        if (changed === true) {
            this.computePlayheadPosition();
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
    /**
     * Draws the layer labels to the canvas.
     */
    drawLayerLabels() {
        let row = 0;
        // Iterate through layers.
        for (let layerName of Object.keys(this._layerLabels)) {
            this._canvas.fillStyle = COLOR_LABEL_BACKGROUND;
            this._canvas.fillRect(0, row * this._rowHeight, this._layerLabelWidth, this._rowHeight);
            this._canvas.fillStyle = TEXT_COLOR;
            this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY;
            this._canvas.textBaseline = 'middle';
            this._canvas.fillText(layerName, 0, (row * this._rowHeight) + (this._rowHeight / 2), this._layerLabelWidth);
            if (this._layerLabels[layerName] !== 0) {
                this._canvas.fillStyle = COLOR_LINE;
                this._canvas.fillRect(this._layerLabelWidth, row * this._rowHeight, this._timelineWidth, THICKNESS_LINE);
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
        const range = this._scaledDrawTimeRange;
        const endTime = this._drawTimeStart + range;
        const circaNumberOfLines = 5;
        const rounder = Math.pow(10, Math.floor(Math.log10(range / circaNumberOfLines))); // What to round the ruler to
        const rounderNext = rounder * 10;
        const numberOfLines = Math.floor(range / rounder);
        const rulerDiff = rounder;
        const startTime = Math.floor(this._drawTimeStart / rounder) * rounder;
        const opacity = (Math.min(1, circaNumberOfLines / numberOfLines));
        if (rulerDiff) {
            this._canvas.strokeStyle = RULER_LINE_COLOR;
            this._canvas.lineWidth = RULER_LINE_WIDTH;
            for (let rulerTime = startTime; rulerTime < endTime; rulerTime += rulerDiff) {
                this._canvas.beginPath();
                let x = this.getObjectOffsetFromTimelineStart(rulerTime);
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
                if (x >= 0) {
                    x += this._timelineStart;
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
            this._canvas.fillStyle = COLOR_PLAYHEAD;
            this._canvas.fillRect(this._playHeadPosition, 0, THICKNESS_PLAYHEAD, this._canvasHeight);
        }
    }
    /**
     * Gets the layers to draw from the timeline.
     */
    getLayersToDraw() {
        this._hoveredObjectMap = {};
        let layersArray = [];
        for (let _j = 0; _j < Object.keys(this._resolvedStates.layers).length; _j++) {
            let layer = Object.keys(this._resolvedStates.layers)[_j];
            if (layersArray.indexOf(layer) === -1) {
                layersArray.push(layer);
            }
        }
        let layers = {};
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
        // Find new playhead position.
        this.computePlayheadPosition();
        // Recompute objects positions
        this._timelineState = this.getTimelineDrawState(this._resolvedStates);
        // Draw the current state.
        this.drawTimelineState(this._timelineState);
        this.drawPlayhead();
    }
    /**
     * Draws a timeline state to the canvas.
     * @param {TimelineDrawState} currentDrawState State to draw.
     */
    drawTimelineState(currentDrawState) {
        for (let element in currentDrawState) {
            if (currentDrawState[element].visible) {
                this._canvas.fillStyle = COLOR_TIMELINE_OBJECT_FILL;
                this._canvas.fillRect(currentDrawState[element].left, currentDrawState[element].top, currentDrawState[element].width, currentDrawState[element].height);
                this._canvas.strokeStyle = COLOR_TIMELINE_OBJECT_BORDER;
                this._canvas.lineWidth = THICKNESS_TIMELINE_OBJECT_BORDER;
                this._canvas.strokeRect(currentDrawState[element].left, currentDrawState[element].top, currentDrawState[element].width, currentDrawState[element].height);
                this._canvas.fillStyle = TEXT_COLOR;
                this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY;
                this._canvas.textBaseline = 'top';
                this._canvas.fillText(element.split(':')[1], currentDrawState[element].left, currentDrawState[element].top);
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
        for (let key in timeline.objects) {
            let timeObj = timeline.objects[key];
            let parentID = timeObj.id;
            for (let _i = 0; _i < timeObj.resolved.instances.length; _i++) {
                let instanceObj = timeObj.resolved.instances[_i];
                let name = 'timelineObject:' + parentID + ':' + instanceObj.id;
                currentDrawState[name] = this.createStateForObject(timeObj.layer + '', instanceObj.start, instanceObj.end);
                if (currentDrawState[name].visible === true) {
                    this._hoveredObjectMap[timeObj.layer + ''].push({
                        startX: currentDrawState[name].left,
                        endX: currentDrawState[name].left + currentDrawState[name].width,
                        name: name
                    });
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
    createStateForObject(layer, start, end) {
        // Default state (hidden).
        let state = { height: 0, left: 0, top: 0, width: 0, visible: false };
        // State should be default if the object is not being shown.
        if (this.showOnTimeline(start, end)) {
            // Get object dimensions and position.
            let objectWidth = this.getObjectWidth(start, end);
            let offset = this.getObjectOffsetFromTimelineStart(start);
            let objectTop = this.getObjectOffsetFromTop(layer);
            // Set state properties.
            state.height = this._timelineObjectHeight;
            state.left = this._timelineStart + offset;
            state.top = objectTop;
            state.width = objectWidth;
            state.visible = true;
        }
        return state;
    }
    /**
     * Calculates the offset, in pixels from the start of the timeline for an object.
     * @param {number} start start time of the object.
     * @returns {number} Offset in pixels.
     */
    getObjectOffsetFromTimelineStart(start) {
        // Calculate offset.
        let offset = (start - this._drawTimeStart) * this._pixelsWidthPerUnitTime;
        // Offset cannot be to the left of the timeline start position.
        if (offset < 0) {
            offset = 0;
        }
        return offset;
    }
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
        if (startTime < this._drawTimeStart) {
            startTime = this._drawTimeStart;
        }
        // Calculate duration of the object remaining on the timeline.
        let duration = endTime - startTime;
        // Return end point position in pixels.
        return duration * this._pixelsWidthPerUnitTime;
    }
    /**
     * Determines whether to show an object on the timeline.
     * @param {number} start Object start time.
     * @param {number} end Object end time.
     * @returns {true} if object should be shown on the timeline.
     */
    showOnTimeline(start, end) {
        let isAfter = start >= this._drawTimeEnd;
        let isBefore = (end || Infinity) <= this._drawTimeStart;
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
        // Check playhead should be drawn.
        let updatePlayhead = false;
        let updateEverything = false;
        if (this._playHeadPlaying && this._drawPlayhead) {
            // Add time to playhead.
            this._playHeadTime += this._playSpeed * dt;
            updatePlayhead = true;
        }
        if (this._playViewPort) {
            let play = true;
            if (this._playHeadPlaying && this._drawPlayhead) {
                // Only play if playhead is visible
                if (this._playHeadTime > this._drawTimeEnd ||
                    this._playHeadTime < this._drawTimeStart) {
                    play = false;
                }
            }
            if (play) {
                this._drawTimeStart += this._playSpeed * dt;
                this._drawTimeEnd += this._playSpeed * dt;
                updateEverything = true;
            }
        }
        if (updateEverything) {
            this.redrawTimeline();
        }
        else if (updatePlayhead) {
            // Calculate new playhead position and redraw if the playhead has moved.
            if (this.computePlayheadPosition()) {
                this.redrawTimeline();
            }
        }
        // call this function on next frame
        window.requestAnimationFrame(() => this.updateDraw());
    }
    /**
     * Calulates the playhead position based on time.
     * @returns true if the playhead has moved.
     */
    computePlayheadPosition() {
        // Get playhead position.
        let pos = this.timeToXCoord(this._playHeadTime);
        if (pos < this._timelineStart) {
            pos = this._timelineStart;
        }
        // Redraw if playhead has moved.
        if (pos !== this._playHeadPosition) {
            this._playHeadPosition = pos;
            return true;
        }
        return false;
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
            if (mousePos.x > this._timelineStart) {
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
                            if (this._lastHoveredName !== object.name) {
                                // Get object metadata from the object name of the hovered object.
                                let meta = this.timelineMetaFromString(object.name);
                                // If we are hovering over a timeline object.
                                if (meta !== undefined && meta.type === 'timelineObject') {
                                    // Get the timeline object and the instance being hovered over.
                                    let timelineObject = this._resolvedStates.objects[meta.name];
                                    let instance = timelineObject.resolved.instances.find(instance => instance.id === meta.instance);
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
                                    // Store last items.
                                    this._lastHoverAction = MOUSEIN;
                                    this._lastHoveredName = object.name;
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
        if (canvasCoord.x <= this._timelineStart) {
            return;
        }
        let changed = false;
        // CTRL + scroll to zoom.
        if (event.ctrlKey === true) {
            // If scrolling "up".
            if (event.deltaY > 0) {
                changed = true;
                // Zoom out.
                this._timelineZoom = this._timelineZoom * Math.pow(ZOOM_FACTOR, Math.abs(event.deltaY));
                // Zoom relative to cursor position.
                this.zoomUnderCursor(canvasCoord.x);
            }
            else if (event.deltaY < 0) {
                changed = true;
                // Zoom in.
                this._timelineZoom = this._timelineZoom / Math.pow(ZOOM_FACTOR, Math.abs(event.deltaY));
                // Zoom relative to cursor position.
                this.zoomUnderCursor(canvasCoord.x);
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
        let targetStart = this._drawTimeStart + (deltaX / this._pixelsWidthPerUnitTime);
        // Starting time cannot be < 0.
        if (targetStart < 0) {
            targetStart = 0;
        }
        // Optimisation, don't redraw if nothing has changed.
        if (targetStart === this._drawTimeStart) {
            return;
        }
        // Calculate end point.
        let targetEnd = targetStart + this._scaledDrawTimeRange;
        // Update timeline start and end values.
        this._drawTimeStart = targetStart;
        this._drawTimeEnd = targetEnd;
    }
    /**
     * Calculates the new scaled timeline start and end times according to the current zoom value.
     */
    updateScaledDrawTimeRange() {
        this._scaledDrawTimeRange = this._drawTimeRange * (this._timelineZoom / 100);
        // Calculate how many pixels are required per unit time.
        this._pixelsWidthPerUnitTime = this._timelineWidth / (this._drawTimeEnd - this._drawTimeStart);
    }
    /**
     * Zooms into/out of timeline, keeping the time under the cursor in the same position.
     * @param cursorX Position of mouse cursor.
     */
    zoomUnderCursor(cursorX) {
        // Get time under cursor.
        let coordToTime = this.cursorPosToTime(cursorX);
        // Calculate position of mouse relative to edges of timeline.
        let ratio = this.getCursorPositionAcrossTimeline(cursorX);
        // Set zoom values.
        this.updateScaledDrawTimeRange();
        // Calculate start and end values.
        let targetStart = coordToTime - (ratio * this._scaledDrawTimeRange);
        let targetEnd = targetStart + this._scaledDrawTimeRange;
        // Start cannot be less than 0 but we must preserve the time range to draw.
        if (targetStart < 0) {
            let diff = -targetStart;
            targetStart = 0;
            targetEnd += diff;
        }
        // Set draw times.
        this._drawTimeStart = targetStart;
        this._drawTimeEnd = targetEnd;
    }
    /**
     * Gets the current time under the mouse cursor.
     * @param cursorX Mouse cursor position (x-axis).
     * @returns Time under cursor, or -1 if the cursor is not over the timeline.
     */
    cursorPosToTime(cursorX) {
        // Check if over timeline.
        if (cursorX <= this._timelineStart || cursorX >= this._timelineStart + this._timelineWidth) {
            return -1;
        }
        let ratio = this.getCursorPositionAcrossTimeline(cursorX);
        return this._drawTimeStart + (this._scaledDrawTimeRange * ratio);
    }
    /**
     * Gets the position of the mouse cursor as a percentage of the width of the timeline.
     * @param cursorX Mouse cursor position.
     * @returns Cursor position relative to timeline width, or -1 if the cursor is not over the timeline.
     */
    getCursorPositionAcrossTimeline(cursorX) {
        // Check if over timeline.
        if (cursorX <= this._timelineStart || cursorX >= this._timelineStart + this._timelineWidth) {
            return -1;
        }
        let diffX = cursorX - this._timelineStart;
        let ratio = diffX / this._timelineWidth;
        return ratio;
    }
    /**
     * Calculates the X position of a time value.
     * @param {number} time The time to convert.
     * @returns {number} The X coordinate of the time.
     */
    timeToXCoord(time) {
        // If playhead is off the canvas
        if (time < this._drawTimeStart) {
            return -1;
        }
        if (time > this._drawTimeEnd) {
            return this._timelineWidth + this._timelineStart;
        }
        // (Proportion of time * timeline width) + layer label width
        return ((time - this._drawTimeStart) / (this._drawTimeEnd - this._drawTimeStart) * this._timelineWidth) + this._timelineStart;
    }
    /**
     * Gets the mouse position relative to the top-left of the canvas.
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
                if (useInstance &&
                    newInstance.start < (newInstance.end || Infinity)) {
                    // If there isn't a resolved object for the new instance, create it.
                    if (Object.keys(newObjects).indexOf(objId) === -1) {
                        let newObject = {
                            content: obj.content,
                            enable: obj.content,
                            id: obj.id,
                            layer: obj.layer,
                            resolved: {
                                instances: [
                                    newInstance
                                ],
                                levelDeep: obj.resolved.levelDeep,
                                resolved: obj.resolved.resolved,
                                resolving: obj.resolved.resolving
                            }
                        };
                        newObjects[objId] = newObject;
                    }
                    else {
                        newObjects[objId].resolved.instances.push(newInstance);
                    }
                }
            });
        });
        return {
            classes: timeline.classes,
            layers: timeline.layers,
            objects: newObjects,
            options: timeline.options,
            statistics: timeline.statistics
        };
    }
    /**
     * Merges two timelines by merging instances of objects that intersect each other.
     * @param past Older timeline.
     * @param present Newer timeline.
     * @returns {ResolvedTimeline} containing merged timelines.
     */
    mergeTimelineObjects(past, present) {
        // Iterate over objects in the first timeline.
        Object.keys(past.objects).forEach((objId) => {
            const pastObj = past.objects[objId];
            // If an object exists in both timelines,
            if (objId in present.objects) {
                const presentObj = present.objects[objId];
                if (
                // Compare the objects, only look into merging them if they look identical
                isEqual(Object.assign({}, pastObj, { resolved: null }), Object.assign({}, presentObj, { resolved: null }))) {
                    // Iterate over all instances of those objects.
                    pastObj.resolved.instances.forEach(pastInstance => {
                        presentObj.resolved.instances.forEach(presentInstance => {
                            // If the instances are next to each other, merge them.
                            if (pastInstance.end === presentInstance.start) {
                                presentInstance.start = pastInstance.start;
                                // Remove the older instance.
                                pastObj.resolved.instances.splice(pastObj.resolved.instances.indexOf(presentInstance), 1);
                            }
                        });
                    });
                }
            }
        });
        return merge(past, present);
    }
    /**
     * Gets metadata for a timeline object from a string representation.
     * @param {string} meta Metadata string.
     * @returns {TimelineObjectMetaData | undefined} Extracted metadata or undefined if the string does not contain the required values.
     */
    timelineMetaFromString(meta) {
        let metaArray = meta.split(':');
        if (metaArray.length === 3) {
            return {
                type: metaArray[0],
                name: metaArray[1],
                instance: metaArray[2]
            };
        }
        return;
    }
}
exports.TimelineVisualizer = TimelineVisualizer;
//# sourceMappingURL=timelineVisualizer.js.map