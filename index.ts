import { Plugin, PluginMeta, PostHogEvent, Properties, Webhook } from '@posthog/plugin-scaffold'

type BooleanChoice = 'Yes' | 'No'

type BrazePlugin = Plugin<{
    config: {
        brazeEndpoint: 'US-01' | 'US-02' | 'US-03' | 'US-04' | 'US-05' | 'US-06' | 'US-08' | 'EU-01' | 'EU-02'
        apiKey: string
        importCampaigns: BooleanChoice
        importCanvases: BooleanChoice
        importCustomEvents: BooleanChoice
        importFeeds: BooleanChoice
        importKPIs: BooleanChoice
        importSegments: BooleanChoice
        importSessions: BooleanChoice
        eventsToExport: string
        userPropertiesToExport: string
        importUserAttributesInAllEvents: BooleanChoice
    }
}>

// NOTE: type is exported for tests
export type BrazeMeta = PluginMeta<BrazePlugin>

const ENDPOINTS_MAP = {
    'US-01': 'https://rest.iad-01.braze.com',
    'US-02': 'https://rest.iad-02.braze.com',
    'US-03': 'https://rest.iad-03.braze.com',
    'US-04': 'https://rest.iad-04.braze.com',
    'US-05': 'https://rest.iad-05.braze.com',
    'US-06': 'https://rest.iad-06.braze.com',
    'US-08': 'https://rest.iad-08.braze.com',
    'EU-01': 'https://rest.fra-01.braze.eu',
    'EU-02': 'https://rest.fra-02.braze.eu',
}

export function ISODateString(d: Date): string {
    function pad(n: number) {
        return n < 10 ? '0' + n : n
    }
    return (
        d.getUTCFullYear() +
        '-' +
        pad(d.getUTCMonth() + 1) +
        '-' +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        ':' +
        pad(d.getUTCMinutes()) +
        ':' +
        pad(d.getUTCSeconds()) +
        '.' +
        pad(d.getUTCMilliseconds()) +
        'Z'
    )
}

function getLastUTCMidnight() {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
}

type BrazeUserAlias = { alias_name: string; alias_label: string }

type BrazeAttribute = {
    external_id?: string
    user_alias?: BrazeUserAlias
    braze_id?: string
    _update_existing_only?: boolean
    push_token_import?: boolean
} & Record<string, unknown>

// NOTE: Reference: https://www.braze.com/docs/api/objects_filters/event_object/
type BrazeEvent = {
    external_id?: string
    user_alias?: BrazeUserAlias
    braze_id?: string
    app_id?: string
    name: string
    time: string // ISO 8601 timestamp
    properties?: Record<string, unknown>
    _update_existing_only?: boolean
}

type BrazeUsersTrackBody = {
    attributes: Array<BrazeAttribute> // NOTE: max length 75
    events: Array<BrazeEvent> // NOTE: max length 75
}

const _generateBrazeRequestBody = (pluginEvent: PostHogEvent, meta: BrazeMeta): BrazeUsersTrackBody => {
    const { event, properties, timestamp } = pluginEvent

    // If we have $set or properties.$set then attributes should be an array
    // of one object. Otherwise it should be an empty array.
    const userProperties: Properties = properties?.$set ?? {}
    const propertiesToExport = meta.config.userPropertiesToExport?.split(',') ?? []
    const filteredProperties = Object.keys(userProperties).reduce((filtered, key) => {
        if (propertiesToExport.includes(key)) {
            filtered[key] = userProperties[key]
        }
        return filtered
    }, {} as Properties)

    const shouldImportAttributes =
        meta.config.importUserAttributesInAllEvents === 'Yes' || meta.config.eventsToExport?.split(',').includes(event)

    const attributes: Array<BrazeAttribute> =
        shouldImportAttributes && Object.keys(filteredProperties).length
            ? [{ ...filteredProperties, external_id: pluginEvent.distinct_id }]
            : []

    // If we have an event name in the exportEvents config option then we
    // should export the event to Braze.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $set: _set, ...eventProperties } = properties ?? {}
    const events: Array<BrazeEvent> = meta.config.eventsToExport?.split(',').includes(event)
        ? [
              {
                  properties: eventProperties,
                  external_id: pluginEvent.distinct_id,
                  name: event,
                  time: timestamp ? ISODateString(new Date(timestamp)) : ISODateString(getLastUTCMidnight()),
              },
          ]
        : []

    return {
        attributes,
        events,
    }
}

export const composeWebhook = (event: PostHogEvent, meta: BrazeMeta): Webhook | void => {
    const brazeRequestBody = _generateBrazeRequestBody(event, meta)

    if (brazeRequestBody.attributes.length === 0 && brazeRequestBody.events.length === 0) {
        return console.log('Nothing to export, event is empty.')
    }

    const brazeUrl = ENDPOINTS_MAP[meta.config.brazeEndpoint]
    return {
        url: `${brazeUrl}/users/track`,
        body: JSON.stringify(brazeRequestBody),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${meta.config.apiKey}`,
        },
        method: 'POST',
    }
}
