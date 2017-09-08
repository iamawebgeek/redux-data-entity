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
  keyExtractor: (unit) => unit.id,
  keyGenerator: () => uniqid.time(),
  cacheRequestsCount: 3,
  cacheValidityTime: null,
}

const defaultActionConfig = {
  optimistic: false,
  force: false,
  data: {},
  params: {},
  additionalMeta: {},
}

export class DataEntity {
  _lastRequestIndex = 0
  constructor(config) {
    this.config = { ...defaultConfig, config }
    this.clear()
  }
  perform(dispatch, action, config, meta) {
    config = { ...defaultActionConfig, config }
    if (!this.isPerforming(action, config) || config.force) {
      const actionPromise = this.config.process(READ_MANY, config)
      const requestId = ++this._lastRequestIndex
      dispatch({ type: this.getConst(action, States.START), config, requestId, meta })
      if (actionPromise !== null) {
        actionPromise
          .then(
            (data) => {
              dispatch({ type: this.getConst(action, States.SUCCESS), payload: data, requestId, meta })
            },
            (error) => {
              dispatch({ type: this.getConst(action, States.FAIL), payload: error, requestId, meta })
            },
          )
      }
      return requestId
    }
    return this._requestStates
      .get(action)
      .findKey(request => request.get('active') && request.get('config').equals(config))
  }
  reducePerform(dispatch, actions, mergeParameters) {
    actions.forEach((action) => {

    })
  }
  clear() {
    this._previousState = null
    this._requestStates = Map.of(
      Object.keys(Actions).reduce((key, mapped) => ({ ...mapped, [key]: new OrderedMap() }), {})
    )
  }
  isPerforming(action, config) {
    let actionState = this._requestStates.get(action).filter(request => request.get('active'))
    if (!config) {
      return actionState.size > 0
    }
    return typeof actionState.find(request => request.get('config').equals(config)) !== 'undefined'
  }
  sortFinishedRequests(requests) {
    return requests
      .filter(request => !request.get('active'))
      .sortBy(
        (value) => value.get('finish'),
        (timeA, timeB) => timeA < timeB ? -1 : +(timeA > timeB)
      )
  }
  getLastError(action, config) {
    let actionState = this._requestStates.get(action)
    if (config) {
      let requestState = actionState.find(request => request.get('config').equals(config))
      return typeof requestState !== 'undefined' && requestState.has('error')
        ? new Error(requestState.get('error'))
        : null
    }
    let lastError = this.sortFinishedRequests(actionState)
      .findLast(request => request.has('error'))
    return typeof lastError !== 'undefined' ? new Error(lastError.get('error')) : null
  }
  getReducers() {
    return {
      [`internal(RDE-${this.config.reducerName})`]: (state, { type, config, requestId, payload }) => {
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
          this._newState(this._requestStates.mergeIn([action, requestId], fromJS(requestState)))
        }
        return this._requestStates
      },
      [this.config.reducerName]: (state) => {
        if (this._previousState !== null && is(this._previousState, this._requestStates)) {
          return state
        }
        let reducerState = new OrderedMap()
        reducerState.withMutations((orderedMap) => {
          this.config.reducerDefault.forEach((item) => {
            let key = this.config.keyExtractor(item).toString()
            orderedMap.set(key, item)
          })
          this.sortFinishedRequests(
              this._requestStates
                .map((value, action) => value.set('action', action))
                .flatten(true)
            )
            .forEach((request) => {
              let payload = request.get('payload', null)
              switch (request.get('action')) {
                case READ_ONE:
                case CREATE_ONE:
                case UPDATE_ONE:
                  if (payload !== null) {
                    payload = List.of(payload)
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
                  request.getIn(['config', 'keys'], new List()).forEach(key => {
                    orderedMap.delete(key)
                  })
              }
            })
          this._requestStates.forEach((requests, action) => {
            requests.forEach((request) => {
              if (request.getIn(['config', 'optimistic'], false) && request.getIn(['config', 'active'], false)) {
                let data = request.getIn(['config', 'data'], new List())
                let actionKeys = request.getIn(['config', 'keys'])
                switch (action) {
                  case CREATE_ONE:
                    data = List.of(data)
                  case CREATE_MANY:
                    if (Iterable.isIterable(data)) {
                      data.forEach((item) => {
                        let key = this.config.keyExtractor(item) || this.config.keyGenerator(item)
                        orderedMap.set(key, item)
                      })
                    }
                    break
                  case UPDATE_ONE:
                    data = List.of(data)
                  case UPDATE_MANY:
                    if (Iterable.isIterable(data)) {
                      data.forEach((item, index) => {
                        let key = (actionKeys && actionKeys.get(index)) || this.config.keyExtractor(item)
                        orderedMap.mergeIn([key.toString()], item)
                      })
                    }
                  case DELETE_ONE:
                  case DELETE_MANY:
                    if (Iterable.isIterable(actionKeys)) {
                      actionKeys.forEach((key) => {
                        orderedMap.delete(key.toString())
                      })
                    }
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