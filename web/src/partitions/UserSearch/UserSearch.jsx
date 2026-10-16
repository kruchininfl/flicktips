import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {searchUsers} from 'redux/actions/profileFriendsActions';
import FriendsList from 'partitions/FriendsList';

import './UserSearch.scss';

const propTypes = {
  dispatch: PropTypes.func.isRequired,
  query   : PropTypes.string,
  results : PropTypes.array,
  loading : PropTypes.bool
};

const DEBOUNCE_MS = 300;

// Finds FlickTips users by name
class UserSearch extends Component {
  state = {value: ''};

  componentWillUnmount() {
    clearTimeout(this._timer);
  }

  handleChange = (e) => {
    const value = e.target.value;

    this.setState({value});
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.props.dispatch(searchUsers(value)), DEBOUNCE_MS);
  };

  renderResults() {
    const {query, results, loading} = this.props;

    if (query.trim().length < 2) {
      return false;
    }

    if (!results.length) {
      return loading ? false : <div className="user-search__empty">Никого не нашли</div>;
    }

    return <FriendsList users={results} />;
  }

  render() {
    return (
      <div className="user-search">
        <div className="user-search__field">
          <span className="user-search__icn icn icn_loupe" />
          <input
            className="user-search__input"
            type="search"
            placeholder="Найти друзей по имени"
            value={this.state.value}
            onChange={this.handleChange}
          />
        </div>
        {this.renderResults()}
      </div>
    );
  }
}

UserSearch.propTypes = propTypes;

function mapStateToProps(state) {
  return state.userFriends.get('search').toJS();
}

export default connect(mapStateToProps)(UserSearch);