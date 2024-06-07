// This App supports pushing events to Braze also, via the `exportEvents` hook. It
// should send any $set attributes to Braze `/users/track` endpoint in the
// `attributes` param as well as events in the `events` property.
//
// For an $identify event with $set properties the PostHog PluginEvent json
// looks like:
//
// {
//   "event": "$identify",
//   "properties": {
//     "$set": {
//       "email": "test@posthog",
//       "name": "Test User"
//     }
//   }
// }
//
// The Braze `/users/track` endpoint expects a json payload like:
//
// {
//   "attributes": {
//     "email": "test@posthog",
//     "name": "Test User"
//   },
//   "events": []
// }
//
// For an $capture event with properties the PostHog PluginEvent json looks
// like:
//
// {
//   "event": "test event",
//   "properties": {
//     "test property": "test value"
//   }
// }
//
// The Braze `/users/track` endpoint expects a json payload like:
//
// {
//   "attributes": {},
//   "events": [
//     {
//       "name": "test event",
//       "properties": {
//         "test property": "test value"
//       }
//     }
//   ]
// }
//

import { BrazeMeta, composeWebhook } from '../index'

beforeAll(() => {
    console.error = jest.fn() // catch console errors
})

test('composeWebhook sends $set attributes and events to Braze', async () => {
    // Create a meta object that we can pass into the composeWebhook
    const meta = {
        config: {
            brazeEndpoint: 'US-03',
            eventsToExport: 'account created',
            userPropertiesToExport: 'email,name',
        },
        global: {},
    } as BrazeMeta

    const webhook = composeWebhook(
        {
            uuid: '018feea0-b4ac-7ccf-8da6-604066675d32',
            event: 'account created',
            timestamp: new Date('2023-06-16T00:00:00.00Z'),
            properties: {
                $set: {
                    email: 'test@posthog',
                    name: 'Test User',
                },
                is_a_demo_user: true,
            },
            distinct_id: 'test',
            team_id: 0,
        },
        meta
    )

    expect(webhook).toBe({
        url: 'https://rest.iad-03.braze.com/users/track',
        body: {
            attributes: [
                {
                    email: 'test@posthog',
                    name: 'Test User',
                    external_id: 'test',
                },
            ],
            events: [
                {
                    // NOTE: $set properties are filtered out
                    properties: {
                        is_a_demo_user: true,
                    },
                    external_id: 'test',
                    name: 'account created',
                    time: '2023-06-16T00:00:00.00Z',
                },
            ],
        },
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer `,
        },
        method: 'POST',
    })
})

test('composeWebhook user properties not sent', async () => {
    // Create a meta object that we can pass into the composeWebhook
    const meta = {
        config: {
            brazeEndpoint: 'US-01',
            eventsToExport: 'account created',
        },
        global: {},
    } as BrazeMeta

    const webhook = composeWebhook(
        {
            uuid: '018feea0-b139-7cb4-8ea3-c41479bba2a7',
            event: 'account created',
            timestamp: new Date('2023-06-16T00:00:00.00Z'),
            properties: {
                $set: {
                    email: 'test@posthog',
                    name: 'Test User',
                },
                is_a_demo_user: true,
            },
            distinct_id: 'test',
            team_id: 0,
        },
        meta
    )

    expect(webhook).toBe({
        url: 'https://rest.iad-01.braze.com/users/track',
        body: {
            attributes: [],
            events: [
                {
                    // NOTE: $set properties are filtered out
                    properties: {
                        is_a_demo_user: true,
                    },
                    external_id: 'test',
                    name: 'account created',
                    time: '2023-06-16T00:00:00.00Z',
                },
            ],
        },
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer `,
        },
        method: 'POST',
    })
})

test('composeWebhook user properties are passed for $identify event even if $identify is not reported', async () => {
    // Create a meta object that we can pass into the composeWebhook
    const meta = {
        config: {
            brazeEndpoint: 'EU-01',
            eventsToExport: 'account created',
            userPropertiesToExport: 'email',
            importUserAttributesInAllEvents: 'Yes',
        },
        global: {},
    } as BrazeMeta

    const webhook = composeWebhook(
        {
            uuid: '018fee99-a412-7566-a30a-3eeefb885460',
            event: '$identify',
            timestamp: new Date('2023-06-16T00:00:00.00Z'),
            properties: {
                $set: {
                    email: 'test@posthog',
                    name: 'Test User',
                },
                is_a_demo_user: true,
            },
            distinct_id: 'test',
            team_id: 0,
        },
        meta
    )

    expect(webhook).toBe({
        url: 'https://rest.fra-01.braze.eu/users/track',
        body: {
            attributes: [
                {
                    email: 'test@posthog',
                    external_id: 'test',
                },
            ],
            events: [],
        },
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer `,
        },
        method: 'POST',
    })
})

test('composeWebhook user properties are not passed for non-whitelisted events', async () => {
    // Create a meta object that we can pass into the composeWebhook
    const meta = {
        config: {
            brazeEndpoint: 'US-01',
            eventsToExport: 'account created',
            userPropertiesToExport: 'email',
            importUserAttributesInAllEvents: 'No',
        },
        global: {},
    } as BrazeMeta

    const webhook = composeWebhook(
        {
            uuid: '018fee94-1cda-74fc-ab2c-0d52dcc4f254',
            event: '$identify',
            timestamp: new Date('2023-06-16T00:00:00.00Z'),
            properties: {
                $set: {
                    email: 'test@posthog',
                    name: 'Test User',
                },
                is_a_demo_user: true,
            },
            distinct_id: 'test',
            team_id: 0,
        },
        meta
    )

    expect(webhook).toBeUndefined()
})
