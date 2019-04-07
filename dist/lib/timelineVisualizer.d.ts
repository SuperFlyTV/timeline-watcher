/// <reference types="node" />
import { fabric } from 'fabric';
import { TimelineObject, ResolveOptions, ResolvedTimeline, ResolvedTimelineObjects, TimelineObjectInstance } from 'superfly-timeline';
import { EventEmitter } from 'events';
/** END STYLING VALUES */
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
declare type Layers = {
    [layer: string]: number;
};
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
    timelineIndex: number;
    name: string;
    instance: string;
}
export declare class TimelineVisualizer extends EventEmitter {
    stepSize: number;
    /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
    private readonly _layerLabelWidthProportionOfCanvas;
    /** @private @readonly Default time range to display. */
    private readonly _defaultDrawRange;
    private _resolvedTimelines;
    private _layerLabels;
    private _layerLabelWidth;
    private _canvasId;
    private _canvas;
    private _canvasWidth;
    private _canvasHeight;
    private _rowHeight;
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
    private _fabricObjects;
    private _layerFabricObjects;
    private _playHeadPlaying;
    private _playViewPort;
    private _drawPlayhead;
    private _playSpeed;
    private _playHeadTime;
    private _playHeadPosition;
    private _updateDrawLastTime;
    private _hoveredOver;
    /**
     * @param {string} canvasId The ID of the canvas object to draw within.
     */
    constructor(canvasId: string, options?: TimelineVisualizerOptions);
    /**
     * Initialises the canvas and registers canvas events.
     */
    initCanvas(): void;
    /**
     * Sets the timeline to draw.
     * @param {TimelineObject[]} timeline Timeline to draw.
     * @param {ResolveOptions} options Options to use for resolving timeline state.
     */
    setTimeline(timeline: TimelineObject[], options: ResolveOptions): void;
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
    calculateRowHeight(layers: Layers): number;
    /**
     * Draws the layer labels to the canvas.
     */
    drawLayerLabels(): void;
    getLayersToDraw(): {
        layers: Layers;
        layersArray: string[];
    };
    /**
     * Draws the timeline initially.
     * @param {ResolvedTimeline} timeline Timeline to draw.
     * @param {ResolveOptions} options Resolve options.
     */
    drawInitialTimeline(timeline: ResolvedTimeline, options: ResolveOptions): void;
    /**
     * Redraws the timeline to the canvas.
     */
    redrawTimeline(): void;
    /**
     * Draws the playhead on the canvas.
     */
    redrawPlayHead(): void;
    /**
     * Draws a timeline state to the canvas.
     * @param {TimelineDrawState} currentDrawState State to draw.
     */
    drawTimelineState(currentDrawState: TimelineDrawState): void;
    /**
     * Returns the draw states for all timeline objects.
     * @param {ResolvedTimeline} timeline Timeline to draw.
     * @param {number} timelineIndex Index of timeline being drawn.
     * @returns {TimelineDrawState} State of time-based objects.
     */
    getTimelineDrawState(timeline: ResolvedTimeline, timelineIndex: number): TimelineDrawState;
    /**
     * Creates a draw state for a timeline object.
     * @param {string} layer Object's layer.
     * @param {number} start Start time.
     * @param {number} end End time.
     * @returns {DrawState} State of the object to draw.
     */
    createStateForObject(layer: string, start: number, end: number | null): DrawState;
    /**
     * Creates a draw state for a timeline object.
     * @param {TimelineObjectInstance} object Object to draw.
     * @param {string} parentName Name of the object's parent (the object the instance belongs to).
     */
    createFabricObject(name: string): void;
    /**
     * Creates all the fabric objects for time-based objects.
     * @param {ResolvedTimelineObjects} timeline Objects to draw.
     * @param {number} timelineIndex Index of timeline being drawn.
     */
    createTimelineFabricObjects(timeline: ResolvedTimelineObjects, timelineIndex: number): void;
    /**
     * Hides all of the timeline objects in the current state.
     * @param currentDrawState State to hide.
     */
    hideTimelineFabricObjects(currentDrawState: TimelineDrawState): void;
    /**
     * Finds the object with the latest end time in a timeline and returns the time.
     * @param {ResolvedTimeline} timeline Timeline to search.
     * @returns Latest end time.
     */
    findMaxEndTime(timeline: ResolvedTimeline): number;
    /**
     * Calculates the offset, in pixels from the start of the timeline for an object.
     * @param {number} start start time of the object.
     * @returns {number} Offset in pixels.
     */
    getObjectOffsetFromTimelineStart(start: number): number;
    /**
     * Calculates the width, in pixels, of an object based on its duration.
     * @param {number} start Start time of the object.
     * @param {number} end End time of the object.
     * @returns {number} Width in pixels.
     */
    getObjectWidth(startTime: number, endTime: number | null): number;
    /**
     * Determines whether to show an object on the timeline.
     * @param {number} start Object start time.
     * @param {number} end Object end time.
     * @returns {true} if object should be shown on the timeline.
     */
    showOnTimeline(start: number, end: number | null): boolean;
    /**
     * Calculate position of object instance from top of timeline according to its layer.
     * @param {string} layer Object's layer.
     * @returns Position relative to top of canvas in pixels.
     */
    getObjectOffsetFromTop(layerName: string): number;
    /**
     * Moves the playhead. Called periodically.
     */
    updateDraw(): void;
    /**
     * Calulates the playhead position based on time.
     * @returns true if the playhead has moved.
     */
    computePlayheadPosition(): boolean;
    /**
     * Handles mouse down event.
     * @param opt Mouse event.
     */
    canvasMouseDown(opt: any): void;
    /**
     * Handles mouse up event.
     * @param opt Mouse event.
     */
    canvasMouseUp(opt: any): void;
    /**
     * Handles mouse movement on canvas.
     * @param opt Mouse event.
     */
    canvasMouseMove(opt: any): void;
    /**
     * Handles scroll wheel events on the canvas.
     * @param opt Scroll event.
     */
    canvasScrollWheel(opt: any): void;
    /**
     * Scroll across the canvas by a specified X value.
     * @param {number} deltaX Value to move by.
     */
    canvasScrollByDeltaX(deltaX: number): void;
    /**
     * Called when a canvas object is hovered over.
     * @param {fabric.IEvent} event Hover event.
     * @param {boolean} over Whether the cursor has moved over an object or out of an object.
     */
    canvasObjectHover(event: fabric.IEvent, over: boolean): void;
    /**
     * Calculates the new scaled timeline start and end times according to the current zoom value.
     */
    updateScaledDrawTimeRange(): void;
    /**
     * Zooms into/out of timeline, keeping the time under the cursor in the same position.
     * @param cursorX Position of mouse cursor.
     */
    zoomUnderCursor(cursorX: number): void;
    /**
     * Gets the current time under the mouse cursor.
     * @param cursorX Mouse cursor position (x-axis).
     * @returns Time under cursor, or -1 if the cursor is not over the timeline.
     */
    cursorPosToTime(cursorX: number): number;
    /**
     * Gets the position of the mouse cursor as a percentage of the width of the timeline.
     * @param cursorX Mouse cursor position.
     * @returns Cursor position relative to timeline width, or -1 if the cursor is not over the timeline.
     */
    getCursorPositionAcrossTimeline(cursorX: number): number;
    /**
     * Calculates the X position of a time value.
     * @param {number} time The time to convert.
     * @returns {number} The X coordinate of the time.
     */
    timeToXCoord(time: number): number;
    /**
     * Trims a timeline so that objects only exist within a specified time period.
     * @param timeline Timeline to trim.
     * @param trim Times to trim between.
     */
    trimTimeline(timeline: ResolvedTimeline, trim: TrimProperties): ResolvedTimeline;
    /**
     * Merges two timelines by merging instances of objects that intersect each other.
     * @param past Older timeline.
     * @param present Newer timeline.
     * @returns {ResolvedTimeline[2]} [past, present] containing altered values.
     */
    mergeTimelineObjects(past: ResolvedTimeline, present: ResolvedTimeline): {
        past: ResolvedTimeline;
        present: ResolvedTimeline;
    };
    /**
     * Gets metadata for a timeline object from a string representation.
     * @param {string} meta Metadata string.
     * @returns {TimelineObjectMetaData | undefined} Extracted metadata or undefined if the string does not contain the required values.
     */
    timelineMetaFromString(meta: string): TimelineObjectMetaData | undefined;
}
export {};
