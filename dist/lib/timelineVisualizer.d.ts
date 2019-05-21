/// <reference types="node" />
import { TimelineObject, ResolveOptions, TimelineObjectInstance } from 'superfly-timeline';
import { EventEmitter } from 'events';
/**  CONSTANTS FOR STATE MANAGEMENT */
export interface TimelineDrawState {
    [id: string]: DrawState;
}
export interface DrawState {
    width: number;
    height: number;
    left: number;
    top: number;
    visible: boolean;
}
/**
 * Allows the viewort of the timeline to be set.
 */
export interface ViewPort {
    /** Timestamp to move the start of the timeline to. */
    timestamp?: number;
    /** Factor to zoom in on the timeline. */
    zoom?: number;
    /** Whether the playhead should be moving. */
    playPlayhead?: boolean;
    /** Move the playhead to a specified time. */
    playheadTime: number;
    /** Whether the viewport is playing */
    playViewPort?: boolean;
    /** The speed to use when playing */
    playSpeed?: number;
}
export interface TimelineVisualizerOptions {
    /** Whether to draw the playhead or not */
    drawPlayhead?: boolean;
}
/**
 * Stores the times to trim a timeline between.
 */
export interface TrimProperties {
    start?: number;
    end?: number;
}
/**
 * Stores the object currently being hovered over.
 */
export interface HoveredObject {
    object: TimelineObject;
    instance: TimelineObjectInstance;
    pointer: {
        xPostion: number;
        yPosition: number;
    };
}
/**
 * Used when splitting up the name of a timeline object to separate out the data stored within the name.
 */
export interface TimelineObjectMetaData {
    type: string;
    name: string;
    instance: string;
}
/**
 * Stores the start and enod poins of an object on a timeline.
 */
export interface HoverMapData {
    startX: number;
    endX: number;
    name: string;
}
/**
 * Stores a map of objects from the timeline displayed on the canvas.
 * layer = layer *name*.
 */
export interface TimelineHoverMap {
    [layer: string]: HoverMapData[];
}
export declare class TimelineVisualizer extends EventEmitter {
    stepSize: number;
    /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
    private readonly _layerLabelWidthProportionOfCanvas;
    /** @private @readonly Default time range to display. */
    private readonly _defaultDrawRange;
    private _resolvedStates;
    private _layerLabels;
    private _timelineState;
    private _hoveredObjectMap;
    private _layerLabelWidth;
    private _canvasId;
    private _canvasContainer;
    private _canvas;
    private _canvasWidth;
    private _canvasHeight;
    private _rowHeight;
    private _rowsTotalHeight;
    private _numberOfLayers;
    private _timelineWidth;
    private _timelineStart;
    private _timelineObjectHeight;
    private _drawTimeStart;
    private _drawTimeEnd;
    private _drawTimeRange;
    private _scaledDrawTimeRange;
    private _pixelsWidthPerUnitTime;
    private _mouseDown;
    private _mouseLastX;
    private _lastScrollDirection;
    private _timelineZoom;
    private _playHeadPlaying;
    private _playViewPort;
    private _drawPlayhead;
    private _playSpeed;
    private _playHeadTime;
    private _playHeadPosition;
    private _updateDrawLastTime;
    private _hoveredOver;
    private _lastHoverAction;
    private _lastHoveredName;
    /**
     * @param {string} canvasId The ID of the canvas object to draw within.
     */
    constructor(canvasId: string, options?: TimelineVisualizerOptions);
    /**
     * Initialises the canvas and registers canvas events.
     */
    private initCanvas;
    /**
     * Updates the timeline, should be called when actions are added/removed from a timeline
     * but the same timeline is being drawn.
     * @param {TimelineObject[]} timeline Timeline to draw.
     * @param {ResolveOptions} options Resolve options.
     */
    updateTimeline(timeline: TimelineObject[], options?: ResolveOptions): void;
    /**
     * Sets the viewport to a position, zoom, and playback speed.
     * Playback speed currently not implemented.
     * @param viewPort Object to update viewport with.
     */
    setViewPort(viewPort: ViewPort): void;
    /**
     * Accessor for polling the currently hovered over object.
     */
    getHoveredObject(): HoveredObject | undefined;
    /**
     * Calculates the height to give to each row to fit all layers on screen.
     * @param {String[]} layers Map of layers to use.
     * @returns Height of rows.
     */
    private calculateRowHeight;
    private updateLayerLabels;
    /**
     * Draws the layer labels to the canvas.
     */
    private drawLayerLabels;
    /**
     * Draws the timeline background.
     */
    private drawBackground;
    /**
     * Draw a ruler on top of background
     */
    private drawBackgroundRuler;
    /**
     * Draws the playhead initially.
     */
    private drawPlayhead;
    /**
     * Gets the layers to draw from the timeline.
     */
    private getLayersToDraw;
    /**
     * Redraws the timeline to the canvas.
     */
    private redrawTimeline;
    /**
     * Draws a timeline state to the canvas.
     * @param {TimelineDrawState} currentDrawState State to draw.
     */
    private drawTimelineState;
    /**
     * Returns the draw states for all timeline objects.
     * @param {ResolvedTimeline} timeline Timeline to draw.
     * @returns {TimelineDrawState} State of time-based objects.
     */
    private getTimelineDrawState;
    /**
     * Creates a draw state for a timeline object.
     * @param {string} layer Object's layer.
     * @param {number} start Start time.
     * @param {number} end End time.
     * @returns {DrawState} State of the object to draw.
     */
    private createStateForObject;
    /**
     * Calculates the offset, in pixels from the start of the timeline for an object.
     * @param {number} start start time of the object.
     * @returns {number} Offset in pixels.
     */
    private getObjectOffsetFromTimelineStart;
    /**
     * Calculates the width, in pixels, of an object based on its duration.
     * @param {number} start Start time of the object.
     * @param {number} end End time of the object.
     * @returns {number} Width in pixels.
     */
    private getObjectWidth;
    /**
     * Determines whether to show an object on the timeline.
     * @param {number} start Object start time.
     * @param {number} end Object end time.
     * @returns {true} if object should be shown on the timeline.
     */
    private showOnTimeline;
    /**
     * Calculate position of object instance from top of timeline according to its layer.
     * @param {string} layer Object's layer.
     * @returns Position relative to top of canvas in pixels.
     */
    private getObjectOffsetFromTop;
    /**
     * Moves the playhead. Called periodically.
     */
    private updateDraw;
    /**
     * Calulates the playhead position based on time.
     * @returns true if the playhead has moved.
     */
    private computePlayheadPosition;
    /**
     * Handles mouse down event.
     * @param event Mouse event.
     */
    private canvasMouseDown;
    /**
     * Handles mouse up event.
     * @param event Mouse event.
     */
    private canvasMouseUp;
    /**
     * Handles mouse movement on canvas.
     * @param event Mouse event.
     */
    private canvasMouseMove;
    /**
     * Handles scroll wheel events on the canvas.
     * @param event Scroll event.
     */
    private canvasScrollWheel;
    /**
     * Scroll across the canvas by a specified X value.
     * @param {number} deltaX Value to move by.
     */
    private canvasScrollByDeltaX;
    /**
     * Calculates the new scaled timeline start and end times according to the current zoom value.
     */
    private updateScaledDrawTimeRange;
    /**
     * Zooms into/out of timeline, keeping the time under the cursor in the same position.
     * @param cursorX Position of mouse cursor.
     */
    private zoomUnderCursor;
    /**
     * Gets the current time under the mouse cursor.
     * @param cursorX Mouse cursor position (x-axis).
     * @returns Time under cursor, or -1 if the cursor is not over the timeline.
     */
    private cursorPosToTime;
    /**
     * Gets the position of the mouse cursor as a percentage of the width of the timeline.
     * @param cursorX Mouse cursor position.
     * @returns Cursor position relative to timeline width, or -1 if the cursor is not over the timeline.
     */
    private getCursorPositionAcrossTimeline;
    /**
     * Calculates the X position of a time value.
     * @param {number} time The time to convert.
     * @returns {number} The X coordinate of the time.
     */
    private timeToXCoord;
    /**
     * Gets the mouse position relative to the top-left of the canvas.
     * @param canvas
     * @param evt
     * @returns {x: number, y: number} Position.
     */
    private getMousePos;
    /**
     * Trims a timeline so that objects only exist within a specified time period.
     * @param timeline Timeline to trim.
     * @param trim Times to trim between.
     */
    private trimTimeline;
    /**
     * Merges two timelines by merging instances of objects that intersect each other.
     * @param past Older timeline.
     * @param present Newer timeline.
     * @returns {ResolvedTimeline} containing merged timelines.
     */
    private mergeTimelineObjects;
    /**
     * Gets metadata for a timeline object from a string representation.
     * @param {string} meta Metadata string.
     * @returns {TimelineObjectMetaData | undefined} Extracted metadata or undefined if the string does not contain the required values.
     */
    private timelineMetaFromString;
}
