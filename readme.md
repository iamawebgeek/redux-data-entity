# redux-data-entity
A library that helps to manage data in easier way with redux

## Features
- Less actions, reducers and constants declaration
- Integrated with [immutable.js](https://github.com/facebook/immutable-js/) for state management
- Caching requests
- Prevents repetitive requests
- Optimistic creates, updates and deletes

## Plans for future work
Check it out [here](docs/plans.md)

## Installation
Installing using node package manager.
Type the following in your console inside your project directory:
```
npm install redux-data-entity --save
```

With yarn:
```
yarn add redux-data-entity
```

Inline HTML including  
coming soon...

## Usage

### Creating new data entity instance
```js
// e.g. entities/user.js file
import {
  DataEntity,
  READ_MANY,
  READ_ONE,
  CREATE_ONE,
  UPDATE_ONE,
  DELETE_ONE,
} from 'redux-data-entity'

export default new DataEntity({
  reducerName: 'users',
  process: (action, config) => {
    const API = 'http://localhost'
    switch (action) {
      case READ_MANY:
        return fetchMyData(`${API}/users`, {
          method: 'GET',
          params: config.params,
        })
      case READ_ONE:
        return fetchMyData(`${API}/users/${config.keys[0]}`, {
          method: 'GET',
          params: config.params,
        })
      case CREATE_ONE:
        return fetchMyData(`${API}/users`, {
          method: 'POST',
          data: config.data,
        })
      case UPDATE_ONE:
        return fetchMyData(`${API}/users/${config.keys[0]}`, {
          method: 'PUT',
          data: config.data,
        })
      case DELETE_ONE:
        return fetchMyData(`${API}/users/${config.keys[0]}`, {
          method: 'DELETE',
          optimistic: true,
        })
    }
    return null
  },
})

// e.g. entities/index.js
import user from './user'
import post from './post'

export default {
  users,
  posts,
}
```
### Combine with other reducers
```js
// e.g reducers/index.js
import { combineDataEntities } from 'redux-data-entity'

import entities from '../entities'

export default combineReducers(
  combineDataEntities(entities, {
  // some other reducers ...
  
  })
)
```
### Using inside component
```js
// e.g. components/SomeDataComponent.js
import { READ_MANY } from 'redux-data-entity'

import entities from '../entities'

class SomeDataComponent extends Component {
  componentDidMount() {
    this.props.userActions(READ_MANY)
  }
  renderLoader() {
    return (
      <SomeActivityIndicator />
    )
  }
  renderContent() {
    return (
      <div>
        {this.props.users.map((user) => (
          <span>{user.get('name')}</span>
        ))}
      </div>
    )
  }
  render() {
    return (
      this.props.isLoadingUsers ? this.renderLoader() : this.renderContent()
    )
  }
}

const mapStateToProps = (state) => ({
  users: state.users,
  // note: any loading state getters should be inside state to props mapper
  isLoadingUsers: entities.users.isPerforming(READ_MANY),
})

const mapDispatchToProps = (dispatch) => ({
  userActions: entities.users.perform(dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(SomeDataComponent)
```