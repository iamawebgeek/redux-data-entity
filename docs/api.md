## Redux Data Entity API

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

#### `getActionHandler(dispatch): actionHandlerFunction`

Gets a redux store dispatcher function and returns a new function that would handle data loading

##### `actionHandlerFunction(action, config, callback, meta)`

- *action* (required): Name of the action to perform (all actions may be imported from the package)
- *config*: Configuration of an action
  - *data*: Data to be processed by `process` function
  - *keys*: Array of a key/keys of processed data units
  - *params*: Additional params (e.g server api query parameters)
  - *optimistic*: If an action is optimistic. Works with creates, updates and deletes. Passed `data` is processed in reducer when an actual request starts, defaults to false.
  - *force*: Run action even if similar one is already running, defaults to false.
- *callback*: Function that would be called when request has finished
- *meta*: Meta that should be passed for dispatched actions

// TODO: write documentation

