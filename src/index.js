import { Map, OrderedMap, fromJS, is, Iterable, List } from 'immutable'
import uniqid from 'uniqid'

const PREFIX = 'RDE'
const Actions = {
  CREATE_ONE: 'CREATE_ONE',
  READ_ONE: 'READ_ONE',
  UPDATE_ONE: 'UPDATE_ONE',
  DELETE_ONE: 'DELETE_ONE',
  CREATE_MANY: 'CREATE_MANY',
  READ_MANY: 'READ_MANY',
  UPDATE_MANY: 'UPDATE_MANY',
  DELETE_MANY: 'DELETE_MANY',
}
export const {
  CREATE_ONE,
  READ_ONE,
  UPDATE_ONE,
  DELETE_ONE,
  CREATE_MANY,
  READ_MANY,
  UPDATE_MANY,
  DELETE_MANY,
} = Actions

export const States = {
  START: 'START',
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
}

const defaultConfig = {
  keyExtractor: (unit) => unit.get('id'),
  keyGenerator: () => uniqid.time(),
  cacheRequestsCount: 3,
  cacheValidityTime: null,
}

const defaultActionConfig = {
  optimistic: false,
  force: false,
  data: {},
  params: {},
}

function sortFinishedRequests(requests) {
  return requests
    .filter((action, key, request) => !request.getIn([key, 'active']))
    .sortBy(
      (value) => value.get('finish'),
      (timeA, timeB) => timeA < timeB ? -1 : +(timeA > timeB)
    )
}

export class DataEntity {
  _lastRequestIndex = 0
  constructor(config) {
    this.config = { ...defaultConfig, ...config }
    this.clear()
  }
  perform(dispatch) {
    return (action, config, callback, meta) => {
      if (!Actions[action]) {
        throw new Error(`Unknown action provided. Please, use on of ${Object(Actions).keys().join(', ')}`)
      }
      config = { ...defaultActionConfig, ...config }
      if (!this.isPerforming(action, config) || config.force) {
        const actionPromise = this.config.process(action, config)
        const requestId = ++this._lastRequestIndex
        const onRequestFinish = () => {
          if (typeof callback === 'function') {
            const request = this._requestStates.getIn([action, requestId])
            callback(request.get('error', null), request.get('payload'))
          }
        }
        dispatch({ type: this.getConst(action, States.START), config, requestId, meta })
        if (actionPromise !== null) {
          actionPromise
            .then(
              (data) => {
                dispatch({ type: this.getConst(action, States.SUCCESS), payload: data, requestId, meta })
                onRequestFinish()
              },
              (error) => {
                dispatch({ type: this.getConst(action, States.FAIL), payload: error, requestId, meta })
                onRequestFinish()
              },
            )
        }
        return requestId
      }
      return this._requestStates
        .get(action)
        .findKey(request => request.get('active') && request.get('config').equals(config))
    }
  }
  clear() {
    this._previousState = null
    this._requestStates = new Map(
      Object.keys(Actions).reduce((mapped, key) => ({ ...mapped, [Actions[key]]: new OrderedMap() }), {})
    )
  }
  isPerforming(action, config) {
    let actionState = this._requestStates.get(action).filter(request => request.get('active'))
    if (!config) {
      return actionState.size > 0
    }
    return typeof actionState.find(request => request.get('config').equals(config)) !== 'undefined'
  }
  getLastError(action, config) {
    let actionState = this._requestStates.get(action)
    if (config) {
      let requestState = actionState.find(request => request.get('config').equals(config))
      return typeof requestState !== 'undefined' && requestState.has('error')
        ? new Error(requestState.get('error'))
        : null
    }
    let lastError = sortFinishedRequests(actionState)
      .findLast(request => request.has('error'))
    return typeof lastError !== 'undefined' ? new Error(lastError.get('error')) : null
  }
  getReducers() {
    return {
      [`internal(RDE:${this.config.reducerName})`]: (oldState, { type, config, requestId, payload }) => {
        let action = this.parseAction(type)
        let state = this.parseState(type)
        if (action !== null && state !== null) {
          let requestState = {}
          if (~[States.FAIL, States.SUCCESS].indexOf(state)) {
            if (!this._requestStates.hasIn([action, requestId])) {
              return this._requestStates
            }
            requestState.active = false
            requestState[state === States.FAIL ? 'error' : 'payload'] = payload
            requestState.finish = Date.now()
          }
          else {
            requestState.config = config
            requestState.active = true
            requestState.start = Date.now()
          }
          requestState.action = action
          this._newState(this._requestStates.mergeIn([action, requestId], fromJS(requestState)))
        }
        return this._requestStates
      },
      [this.config.reducerName]: (state) => {
        if (this._previousState !== null && is(this._previousState, this._requestStates)) {
          return state || new OrderedMap()
        }
        let reducerState = new OrderedMap()
        reducerState = reducerState.withMutations((orderedMap) => {
          if (this.config.reducerDefault) {
            this.config.reducerDefault.forEach((item) => {
              let key = this.config.keyExtractor(item).toString()
              orderedMap.set(key, item)
            })
          }
          sortFinishedRequests(this._requestStates.flatten(1))
            .forEach((request) => {
              let payload = request.get('payload', null)
              switch (request.get('action')) {
                case READ_ONE:
                case CREATE_ONE:
                case UPDATE_ONE:
                  if (payload !== null) {
                    payload = new List([payload])
                  }
                case READ_MANY:
                case CREATE_MANY:
                case UPDATE_MANY:
                  if (payload !== null && Iterable.isIterable(payload)) {
                    payload.forEach((item) => {
                      let key = this.config.keyExtractor(item).toString()
                      orderedMap.set(key, item)
                    })
                  }
                  break
                case DELETE_ONE:
                case DELETE_MANY:
                  if (!request.has('error')) {
                    request.getIn(['config', 'keys'], new List()).forEach(key => {
                      orderedMap.delete(key)
                    })
                  }
                  break
              }
            })
          this._requestStates.forEach((requests, action) => {
            requests.forEach((request) => {
              if (request.getIn(['config', 'optimistic'], false) && request.get('active', false)) {
                let data = request.getIn(['config', 'data'], new List())
                let actionKeys = request.getIn(['config', 'keys'])
                switch (action) {
                  case CREATE_ONE:
                    data = new List([data])
                  case CREATE_MANY:
                    if (Iterable.isIterable(data)) {
                      data.forEach((item) => {
                        let key = this.config.keyExtractor(item) || this.config.keyGenerator(item)
                        orderedMap.set(key, item)
                      })
                    }
                    break
                  case UPDATE_ONE:
                    data = new List([data])
                  case UPDATE_MANY:
                    if (Iterable.isIterable(data)) {
                      data.forEach((item, index) => {
                        let key = (actionKeys && actionKeys.get(index)) || this.config.keyExtractor(item)
                        orderedMap.mergeDeepIn([key.toString()], item)
                      })
                    }
                    break
                  case DELETE_ONE:
                  case DELETE_MANY:
                    if (Iterable.isIterable(actionKeys)) {
                      actionKeys.forEach((key) => {
                        orderedMap.delete(key.toString())
                      })
                    }
                    break
                }
              }
            })
          })
        })
        this._previousState = this._requestStates
        return reducerState
      },
    }
  }
  getConst(action, state) {
    return `${PREFIX}/${this.config.reducerName}/${action}_${state}`
  }
  _newState(state) {
    this._requestStates = state.map((requests, action) => requests.takeLast(this.config.cacheRequestsCount))
  }
  parseAction(actionType) {
    for (let action in Actions) {
      if (actionType.startsWith(`${PREFIX}/${this.config.reducerName}/${action}`)) {
        return action
      }
    }
    return null
  }
  parseState(actionType) {
    let action = this.parseAction(actionType)
    if (action !== null) {
      for (let state in States) {
        if (actionType === `${PREFIX}/${this.config.reducerName}/${action}_${state}`) {
          return state
        }
      }
    }
    return null
  }
}

export const combineDataEntities = (entities, reducers = {}) => (
  Object.keys(entities).reduce((mergedReducers, entityName) => ({
    ...mergedReducers,
    ...entities[entityName].getReducers(),
  }), reducers)
)