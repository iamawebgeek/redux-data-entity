# redux-data-entity
A library that helps to manage data in easier way with redux

## Features
- Less actions, reducers and constants declaration
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
// e.g. entities/index.js
import {
  configureDataEntity,
  Actions,
} from 'redux-data-entity'
import { fetchMyData } from './localUtils'

const createDataEntities = configureDataEntity(
  {
    process: (action, config, instanceConfig) => {
      const API = `http://localhost/${instanceConfig.endpoint}`
      switch (action) {
        case Actions.READ_MANY:
          return fetchMyData(`${API}`, {
            method: 'GET',
            params: config.params,
          })
        case Actions.READ_ONE:
          return fetchMyData(`${API}/${config.keys[0]}`, {
            method: 'GET',
            params: config.params,
          })
        case Actions.CREATE_ONE:
          return fetchMyData(`${API}`, {
            method: 'POST',
            data: config.data,
          })
        case Actions.UPDATE_ONE:
          return fetchMyData(`${API}/${config.keys[0]}`, {
            method: 'PUT',
            data: config.data,
          })
        case Actions.DELETE_ONE:
          return fetchMyData(`${API}/${config.keys[0]}`, {
            method: 'DELETE',
            optimistic: true,
          })
      }
      return null
    },
  }
)
export default createDataEntities({
  users: {
    endpoint: 'v1/user',
  },
  posts: {
    endpoint: 'v1/posts',
  },
  comments: {
    endpoint: 'v2/comments',
  }
})
```
### Combine with other reducers
```js
// e.g reducers/index.js
import { combineDataEntities } from 'redux-data-entity'

import entities from '../entities'

export default combineReducers(
  ...combineEntities(entities),
  {
    // other reducers
  },
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
        {Object.keys(this.props.users).map((key) => {
          const user = this.props.users[key]
          return (
            <span>{user.name}</span>            
          )
        })}
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
  userActions: entities.users.getActionHandler(dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(SomeDataComponent)
```