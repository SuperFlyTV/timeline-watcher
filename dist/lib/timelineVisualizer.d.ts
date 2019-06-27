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
    title: string;
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
    objectRefId: string;
    type: string;
    instanceId: string;
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
    /** Timeline currently drawn. */
    private _resolvedStates;
    /** Layers on timeline. */
    private _layerLabels;
    /** State of the timeline. */
    private _timelineState;
    /** Map of objects for determining hovered object */
    private _hoveredObjectMap;
    /** Width of column of layer labels. */
    private _layerLabelWidth;
    /** Canvas ID. */
    private _canvasId;
    /** Canvas HTML container. */
    private _canvasContainer;
    /** Canvas to draw to. */
    private _canvas;
    /** Width of the canvas [pixels] */
    private _canvasWidth;
    /** Height of the canvas [pixels] */
    private _canvasHeight;
    /** Height of a timeline row [pixels] */
    private _rowHeight;
    /** Height of all of the rows. */
    private _rowsTotalHeight;
    /** Number of layers. */
    private _numberOfLayers;
    /** Width of the actual drawing-view within the canvas [pixels] */
    private _viewDrawWidth;
    /** Start of the drawing-view relative to the left of the canvas [pixels] */
    private _viewDrawX;
    /** Height of objects to draw [pixels] */
    private _timelineObjectHeight;
    /** Start time of the current view. Defines the objects within view on the timeline [time] */
    private _viewStartTime;
    /** Range of the current view [time] */
    /** Store whether the mouse is held down, for scrolling. */
    private _mouseDown;
    /** Last x positions of the mouse cursor (on click and on drag), for scrolling. */
    private _mouseLastX;
    /** Last direction the user moved on the timeline, helps to smooth changing scroll direction. */
    private _lastScrollDirection;
    /** Current zoom amount. */
    private _timelineZoom;
    /** Whether or not the playhead should move. */
    private _playHeadPlaying;
    /** Whether or not the viewport should move */
    private _playViewPort;
    /** Whether to draw the playhead or not */
    private _drawPlayhead;
    /** Speed of the playhead [units / second] */
    private _playSpeed;
    /** The current time position of the playhead. */
    private _playHeadTime;
    /** The last time updateDraw() did a draw. */
    private _updateDrawLastTime;
    /** The object currently being hovered over. */
    private _hoveredOver;
    /** Whether the mouse last moved over an object or out. */
    private _lastHoverAction;
    /** Name of object that was last hovered over. */
    private _lastHoveredHash;
    /** If the visualizer automatically should re-resolve the timeline when navigating the viewport */
    private _timelineResolveAuto;
    /** At what time the timeline was resolved [time] */
    private _timelineResolveStart;
    private _timelineResolveEnd;
    private _timelineResolveZoom;
    private _timelineResolveCount;
    private _timelineResolveCountAdjust;
    /** How much extra (outside the current viewport) the timeline should be resolved to [ratio] */
    private _timelineResolveExpand;
    private latestTimeline;
    private latestUpdateTime;
    private latestOptions;
    private reresolveTimeout;
    private _mergeIterator;
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
    private _updateTimeline;
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
     * @param {ResolvedStates} timeline Timeline to draw.
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
     * Zooms into/out of timeline, keeping the time under the cursor in the same position.
     * @param cursorX Position of mouse cursor.
     */
    private zoomUnderCursor;
    /**
     * Gets the mouse position relative to the top-left of the canvas [pixels]
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
    private updateTimelineResolveWindow;
    private getExpandedStartEndTime;
    private checkAutomaticReresolve;
    /**
     * Calculate the X coordinate of a time value.
     * @param {number} time The time to convert.
     * @returns {number} The X coordinate of the time.
     */
    private timeToXCoord;
    /**
     * Calculate the time of a X coordinate.
     * @param {number} time The X coordinate to convert.
     * @returns {number} The time of the X coordinate.
     */
    private xCoordToTime;
    /** Calculate the ratio of the time in current view (0 i beginning, 1 is end)  */
    private timeToRatio;
    /** Returns true if the position is within the current view  */
    private istimeInView;
    private capXcoordToView;
    /** Zoom factor [pixels / time] */
    private readonly pixelsWidthPerUnitTime;
    /** The range of the view [time] */
    private readonly viewRange;
    /** The end time of the view [time] */
    private readonly viewEndTime;
}
