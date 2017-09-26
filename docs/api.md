## Redux Data Entity API

### `Actions`
Enum containing all these actions:

- `READ_MANY` Use this to load an array of data unit
- `READ_ONE` Use this to load a data unit object
- `CREATE_MANY` Use this to create an array of data units, **array** of objects should be passed only via `data` property of `config` parameter of action handler function
- `CREATE_ONE` Use this to create single data unit, **an object** should be passed only via `data` property of `config` parameter of action handler function
- `UPDATE_MANY` Use this to update an array of data units, **array** of objects AND **array** of keys should be passed only via `data` AND `keys` properties of `config` parameter of action handler function in respective order
- `UPDATE_ONE` Use this to update single data unit, **an object** AND its **key (in an array)** should be passed only via `data` AND **keys** property of `config` parameter of action handler function
- `DELETE_MANY` Use this to delete an array of data units, **keys** of data units to be deleted should be passed as an array 
- `DELETE_ONE` Works the same as `DELETE_MANY`
- `CLEAR` Use this to fully clear requests cache and reducer state

### `Action`
One of the actions from `Actions` enum. List given above

### `ActionConfig`
Object containing configuration of an action
- *data*: Data to be processed by `process` function
- *keys*: Array of a key/keys of processed data units
- *params*: Additional params (e.g server api query parameters)
- *optimistic*: If an action is optimistic. Works with creates, updates and deletes. Passed `data` is processed in reducer when an actual request starts, defaults to false.
- *force*: Run action even if similar one is already running, defaults to false.

### `States`
Enum containing request states:

- `START`
- `SUCCESS`
- `FAIL`

### `combineDataEntities(entities)`
Function that extracts reducers from entities

### `configureDataEntity(config)`
Returns a new function for creating `data entity` with given global options.

- *config*: Configuration of a new DataEntity instance with some required keys
  - *reducerName* (required): Name of your reducer to access data later (should be unique)
  - *process* (required): Function that would accept action and passed action configuration and return Promise, which would get your data
  - *reducerDefault*: Default state of the reducer
  - *keyExtractor*: Function that extracts key of a data unit. Defaults to id property getter
  - *keyGenerator*: Function that would generate a key for new optimistic data units. Defaults to `uniqid` module id generation `time` method
  - *responseValidityTime*: Duration (in microseconds) of requests validity, if given object, checks property of necessary action

#### `getActionConfig()`
Returns default action config

#### `getActionHandler(dispatch): actionHandlerFunction`
Gets a redux store dispatcher function and returns a new function for handling given actions

##### `actionHandlerFunction(action, config, callback, meta)`
- *action* (required): Refer `Action`
- *config*: Refer `ActionConfig`
- *callback*: Function that would be called when request has finished
- *meta*: Meta that should be passed for dispatched actions

#### `getCacheCleaner(dispatch): cacheCleanerFunction`
Gets a redux store dispatcher function and returns a new function for clearing instance requests cache

#### `getConfig()`
Returns instance config

#### `getConst(action, state)`
Returns redux action type for given action and config e.g. `RDE/reducerName/READ_MANY_SUCCESS` 
- *action* (required): Refer `Action`
- *state*: Refer `States`

#### `getLastError(action, config)`
Returns `Error` or `null` based on last finished request for given parameters 
- *action* (required): Refer `Action`
- *config*: Refer `ActionConfig`

#### `getReducer()`
Returns reducer function. Used by `combineDataEntities` function

#### `isPerforming(action, config)`
Returns if request with given parameter is active
- *action* (required): Refer `Action`
- *config*: Refer `ActionConfig`

#### `isOptimistic(key)`
Returns whether given data unit key is optimistic or not
- *key* (required): Data unit string key

#### `parseAction(constant)`
Returns `Action` or null if constant is not recognized
- *constant* (required): Redux action type string

#### `parseState(constant, action)`
Returns `State` or null if constant is not recognized
- *constant* (required): Redux action type string
- *action*: Refer `Action` (used to skip some checks, fully optional)

#### `shouldRequest(action, config)`
Returns whether request with given parameter is active or its response is still valid
- *action* (required): Refer `Action`
- *config*: Refer `ActionConfig`
