import {
	Resolver,
	Enums,
	UnresolvedTimeline
} from 'superfly-timeline'

import { TimelineVisualizer } from './lib/timelineVisualizer'

let myTimeline: UnresolvedTimeline = [
	{
		id: 'video0',
		trigger: {
			type: Enums.TriggerType.TIME_ABSOLUTE,
			value: 1000
		},
		duration: 10 * 1000,
		LLayer: 'mainLayer',
		content: {}
	},{
		id: 'video1',
		trigger: {
			type: Enums.TriggerType.TIME_ABSOLUTE,
			value: 9000
		},
		duration: 31 * 1000,
		LLayer: 'mainLayer',
		content: {}
	},{
		id: 'graphics0',
		trigger: {
			type: Enums.TriggerType.TIME_RELATIVE,
			value: '#video1.start + 1000'
		},
		duration: 10 * 1000,
		LLayer: 'graphicsLayer',
		content: {}
	},{
		id: 'graphics1',
		trigger: {
			type: Enums.TriggerType.TIME_RELATIVE,
			value: '#video1.start + 15000'
		},
		duration: '#video1.end - .start',
		LLayer: 'graphicsLayer',
		content: {}
	},{
		id: 'graphicsKey0',
		trigger: {
			type: Enums.TriggerType.LOGICAL,
			value: '$LgraphicsLayer & !$LPSALayer'
		},
		LLayer: 'DSK',
		content: {}
	},{
		id: 'bgLoop',
		trigger: {
			type: Enums.TriggerType.LOGICAL,
			value: '!$LmainLayer'
		},
		LLayer: '$LmainLayer',
		content: {}
	},{
		id: 'importantMessage',
		trigger: {
			type: Enums.TriggerType.TIME_ABSOLUTE,
			value: 15000
		},
		duration: 10 * 1000,
		LLayer: 'PSALayer',
		content: {}
	},{
		id: 'psaLoop',
		trigger: {
			type: Enums.TriggerType.LOGICAL,
			value: '$LPSALayer'
		},
		LLayer: '$LmainLayer',
		priority: 10,
		content: {}
	}
]

let anotherTimeline: UnresolvedTimeline = [
	{
		id: 'video0',
		trigger: {
			type: Enums.TriggerType.TIME_ABSOLUTE,
			value: 1000
		},
		duration: 10 * 1000,
		LLayer: 'mainLayer',
		content: {}
	},{
		id: 'video1',
		trigger: {
			type: Enums.TriggerType.TIME_ABSOLUTE,
			value: 9000
		},
		duration: 31 * 1000,
		LLayer: 'mainLayer',
		content: {}
	},{
		id: 'graphics0',
		trigger: {
			type: Enums.TriggerType.TIME_RELATIVE,
			value: '#video1.start + 1000'
		},
		duration: 10 * 1000,
		LLayer: 'graphicsLayer',
		content: {}
	},{
		id: 'graphics1',
		trigger: {
			type: Enums.TriggerType.TIME_RELATIVE,
			value: '#video1.start + 15000'
		},
		duration: '#video1.end - #graphics1.start',
		LLayer: 'graphicsLayer',
		content: {}
	},{
		id: 'graphicsKey0',
		trigger: {
			type: Enums.TriggerType.LOGICAL,
			value: '$LgraphicsLayer & !$LPSALayer'
		},
		LLayer: 'DSK',
		content: {}
	},{
		id: 'bgLoop',
		trigger: {
			type: Enums.TriggerType.LOGICAL,
			value: '!$LmainLayer'
		},
		LLayer: 'mainLayer',
		content: {}
	},{
		id: 'importantMessage',
		trigger: {
			type: Enums.TriggerType.TIME_ABSOLUTE,
			value: 15000
		},
		duration: 10 * 1000,
		LLayer: 'PSALayer',
		content: {}
	},{
		id: 'psaLoop',
		trigger: {
			type: Enums.TriggerType.LOGICAL,
			value: '$LPSALayer'
		},
		LLayer: 'mainLayer',
		priority: 10,
		content: {}
	}
]

// By resolving the timeline, the times of the objects are calculated:
let tl = Resolver.getTimelineInWindow(myTimeline)
let otl = Resolver.getTimelineInWindow(anotherTimeline)

// To see whats on right now, we fetch the State:
let now = 3000
let stateNow = Resolver.getState(tl, now)

console.log('Resolved timeline', tl)
console.log('Resolved state', stateNow)
console.log('Other resolved state', otl)

let visuals = new TimelineVisualizer('timeline')

visuals.setTimeline(anotherTimeline)
