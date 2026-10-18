import { describe, expect, it } from 'vitest'
import { splitTarget, tagGroups } from './train-image-refs'

describe('image names and tags in the run dialog', () => {
  it('splits a build target into name, namespace and dist', () => {
    expect(splitTarget('speechanalytics/speech-analytics-ui (rhel)')).toEqual({
      name: 'speech-analytics-ui',
      namespace: 'speechanalytics',
      dist: 'rhel'
    })
    expect(splitTarget('sa-engine')).toEqual({ name: 'sa-engine', namespace: '', dist: '' })
  })

  it('groups image refs by registry and keeps only the tag', () => {
    expect(
      tagGroups([
        'docker.spitch.ch/speechanalytics/speech-analytics-ui:3.3b12104',
        'docker.spitch.ch/speechanalytics/speech-analytics-ui:3.3',
        'docker.voice.bssys.com/speechanalytics/speech-analytics-ui:2.13b12104'
      ])
    ).toEqual([
      { registry: 'docker.spitch.ch', tags: ['3.3b12104', '3.3'] },
      { registry: 'docker.voice.bssys.com', tags: ['2.13b12104'] }
    ])
  })

  it('reads a registry port as part of the host, and a bare repo as no registry', () => {
    expect(tagGroups(['localhost:5000/dc/x:1.0', 'dc/x'])).toEqual([
      { registry: 'localhost:5000', tags: ['1.0'] },
      { registry: '', tags: ['latest'] }
    ])
  })
})
