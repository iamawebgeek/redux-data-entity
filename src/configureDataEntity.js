import uniqid from 'uniqid'
import _ from 'lodash'

import * as Actions from './variables/actions'
import * as States from './variables/states'

export default function configureDataEntity(globalEntityConfig = {}, globalActionConfig = {}) {
  const defaultEntityConfig = {
    keyExtractor: (unit) => unit.id,
    keyGenerator: (unit) => uniqid.time(),
    valueExtractor: (unit) => unit,
    reducerDefault: [],
    responseValidityTime: null,
    ...globalEntityConfig,
  }
  const defaultActionConfig = {
    optimistic: false,
    force: false,
    ...globalActionConfig,
  }
  function createDataEntityInstance(reducerName, config = {}) {
    const instanceConfig = {
      reducerName,
      ...defaultEntityConfig,
      ...config,
    }
    let requests = []
    let optimisticKeys = []

    if (typeof instanceConfig.reducerName !== 'string') {
      throw new Error(
        'Data entity reducer name has to be a string. ' +
        `Instead specified ${instanceConfig.reducerName}`
      )
    }
    if (typeof instanceConfig.process !== 'function') {
      throw new Error(
        'Data entity config process property has to be a function'
      )
    }

    function parseAction(type) {
      for (let action in Actions) {
        if (type.startsWith(`RDE/${instanceConfig.reducerName}/${action}`)) {
          return action
        }
      }
      return null
    }

    function parseState(type, action = this.parseAction(type)) {
      if (action !== null) {
        for (let state in States) {
          if (type === `RDE/${instanceConfig.reducerName}/${action}_${state}`) {
            return state
          }
        }
      }
      return null
    }

    function sortByFinishTime(completed) {
      return completed.sort((request1, request2) =>
        request1.finishTime < request2.finishTime ? -1 : +(request1.finishTime > request2.finishTime)
      )
    }

    function addUnit(items, unit) {
      return {
        ...items,
        [instanceConfig.keyExtractor(unit)]: instanceConfig.valueExtractor(unit),
      }
    }

    function removeUnit(items, key) {
      return _.omit(items, key)
    }

    function addOptimisticUnit(items, unit) {
      const optimisticKey = instanceConfig.keyExtractor(unit) || instanceConfig.keyGenerator(unit)
      optimisticKeys.push(optimisticKey)
      return {
        ...items,
        [optimisticKey]: unit,
      }
    }

    function newState() {
      let items = {}
      let { optimistic, succeeded } = requests.reduce((requestObj, request) => {
        const key = typeof request.finishTime === 'undefined' ? 'optimistic' : 'succeeded'
        if ((key === 'optimistic' && !request.config.optimistic) || request.error) {
          return requestObj
        }
        return {
          ...requestObj,
          [key]: requestObj[key].concat(request),
        }
      }, { optimistic: [], succeeded: [] })
      if (!Array.isArray(instanceConfig.reducerDefault)) {
        items = instanceConfig.reducerDefault
      }
      else {
        instanceConfig.reducerDefault.forEach((item) => {
          addUnit(items, item)
        })
      }
      succeeded = sortByFinishTime(succeeded)
      succeeded.forEach(({ action, result, config }) => {
        switch (action) {
          case Actions.READ_ONE:
          case Actions.CREATE_ONE:
          case Actions.UPDATE_ONE:
            result = [result]
          case Actions.READ_MANY:
          case Actions.CREATE_MANY:
          case Actions.UPDATE_MANY:
            result.forEach((unit) => {
              items = addUnit(items, unit)
            })
            break
          case Actions.DELETE_ONE:
          case Actions.DELETE_MANY:
            config.keys.forEach((key) => {
              items = removeUnit(items, key)
            })
            break
        }
      })
      optimistic.forEach(({ action, config: { data, keys } }) => {
        switch (action) {
          case Actions.CREATE_ONE:
            data = _.castArray(data)
          case Actions.CREATE_MANY:
            data.forEach((unit) => {
              items = addOptimisticUnit(items, unit)
            })
            break
          case Actions.UPDATE_ONE:
            data = _.castArray(data)
          case Actions.UPDATE_MANY:
            keys.forEach((key, index) => {
              items[key] = { ...items[key], ...data[index] }
            })
            break
          case Actions.DELETE_ONE:
          case Actions.DELETE_MANY:
            keys.forEach((key) => {
              items = removeUnit(items, key)
            })
            break
        }
      })
      return items
    }

    function getReducer() {
      return function (state, { type, payload, meta: { dataEntity } = {} }) {
        const action = parseAction(type)
        const requestState = parseState(type, action)
        if (action === Actions.CLEAR) {
          requests = []
          optimisticKeys = []
          state = undefined
        }
        let modified = _.isUndefined(state)
        if (action !== null && requestState !== null) {
          if (requestState === States.START) {
            dataEntity.startTime = +Date.now()
            dataEntity.action = action
            requests.push(dataEntity)
            modified = dataEntity.config.optimistic
          }
          else {
            dataEntity.finishTime = +Date.now()
            dataEntity[requestState === States.FAIL ? 'error' : 'result'] = payload
            modified = requests.indexOf(dataEntity) !== -1
          }
          if (!modified) {
            state = { ...state }
          }
        }
        return modified ? newState() : state
      }
    }

    function getConfig() {
      return { ...instanceConfig }
    }

    function cacheIsValid(action, req) {
      if (instanceConfig.responseValidityTime !== null) {
        let duration = _.isPlainObject(instanceConfig.responseValidityTime)
          ? instanceConfig.responseValidityTime[action]
          : instanceConfig.responseValidityTime
        if (!_.isNumber(duration)) {
          return false
        }
        return +Date.now() - req.finishTime < duration
      }
      return false
    }

    function shouldRequestInner(action, config, request) {
      let valid = false
      let active = requestHas(action, config, (req) => {
        if (_.isNumber(req.finishTime)) {
          if (_.isUndefined(req.error) && cacheIsValid(action, req)) {
            valid = true
          }
          request = req
          return false
        }
        return true
      })
      return !active && !valid
    }

    function isOptimistic(key) {
      return optimisticKeys.indexOf(key) !== -1
    }

    function shouldRequest(action, config) {
      return shouldRequestInner(action, config)
    }

    function getActionHandler(dispatch) {
      return function (action, config, callback, meta = {}) {
        let request = null
        function onFinish(error, result) {
          if (_.isFunction(callback)) {
            callback(error, result)
          }
          if (request !== null) {
            requests.splice(requests.indexOf(request), 1)
          }
        }
        config = { ...defaultActionConfig, ...config }
        if (config.force || shouldRequestInner(action, config, request)) {
          const dataEntity = { config }
          dispatch({ type: getConst(action, States.START), meta: { ...meta, dataEntity  } })
          const actionRequest = instanceConfig.process(action, dataEntity.config, getConfig())
          if (actionRequest !== null) {
            actionRequest.then(
              (result) => {
                dispatch({ type: getConst(action, States.SUCCESS), meta: { ...meta, dataEntity  }, payload: result })
                onFinish(null, result)
              },
              (error) => {
                dispatch({ type: getConst(action, States.FAIL), meta: { ...meta, dataEntity  }, payload: error })
                onFinish(error)
              },
            )
          }
          else {
            onFinish(null)
          }
        }
      }
    }

    function getCacheCleaner(dispatch) {
      return function () {
        dispatch({ type: this.getConst(Actions.CLEAR) })
      }
    }

    function getConst(action, state = null) {
      return `RDE/${instanceConfig.reducerName}/${action}${state !== null ? '_' + state : ''}`
    }

    function requestHas(action, config, matches) {
      return [...requests].reverse().some((request) => {
        if (request.action !== action) {
          return false
        }
        if (!config) {
          return matches(request)
        }
        return _.isEqual(request.config, { ...defaultActionConfig, ...config }) ? matches(request) : false
      })
    }

    function isPerforming(action, config) {
      return requestHas(action, config, (req) => _.isUndefined(req.finishTime))
    }

    function getLastError(action, config) {
      let lastError = null
      requestHas(action, config, (req) => {
        if (req.error) {
          lastError = req.error
        }
        return req.error
      })
      return lastError === null || lastError instanceof Error ? lastError : new Error(lastError)
    }

    return {
      isPerforming,
      isOptimistic,
      shouldRequest,
      getCacheCleaner,
      getActionHandler,
      getReducer,
      getConst,
      getConfig,
      getLastError,
      parseState,
      parseAction,
    }
  }
  return function (entities) {
    let entityKeys = entities
    if (!Array.isArray(entities)) {
      entityKeys = Object.keys(entities)
    }
    return entityKeys.reduce((entitiesObject, key) => ({
      ...entitiesObject,
      [key]: createDataEntityInstance(key, entities[key]),
    }), {})
  }
}