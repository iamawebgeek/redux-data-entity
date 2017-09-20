import _ from 'lodash'

export default function combineEntities(entities) {
  return _.reduce(entities, (combined, value, key) => ({
    ...combined,
    [value.getConfig().reducerName]: value.getReducer(),
  }), {})
}