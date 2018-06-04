import React from 'react';
import PropTypes from 'prop-types';
import {asyncConnect}  from 'redux-connect';
import {getProfile, loadVotes} from 'redux/actions/profileActions';
import MoviePreview from 'partitions/MoviePreview';
import {pluralGender} from 'helpers';
import moment from 'moment';
import 'moment/locale/ru';
import Button from 'components/Gui/Button';
import ProfileLayout from './ProfileLayout';
import {isUserSignedIn} from '../../redux/models/user';

const propTypes = {
  dispatch    : PropTypes.func,
  pending     : PropTypes.bool,
  loaded      : PropTypes.bool,
  loading     : PropTypes.bool,
  params      : PropTypes.any,
  isMyPage    : PropTypes.bool,
  user        : PropTypes.any,
  votes       : PropTypes.any,
  userSignedIn: PropTypes.bool
};

@asyncConnect([
  {
    key    : 'profile',
    promise: ({params, store}) => {
      return store.dispatch(getProfile(params && params.id ? params.id : null));
    }
  }
], mapStateToProps)

class ProfilePage extends ProfileLayout {
  constructor(props) {
    super(props);

    this.entityIsActive = this.entityIsActive.bind(this);
    this.handleLoadData = this.handleLoadData.bind(this);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.userSignedIn !== nextProps.userSignedIn) {
      this.props.dispatch(getProfile(this.props.params && this.props.params.id ? this.props.params.id : null));
    }
  }

  handleLoadData() {
    const {user, votes, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(loadVotes(user.id, votes.page + 1));
  }

  entityIsActive(entity) {
    return entity.isLiked || entity.isDisliked || entity.isNeutral;
  }

  renderVotes(response) {
    const durations = [];

    return response.entities.map((entity, key) => {
      const inactiveClass = this.props.isMyPage && !this.entityIsActive(entity) ? ' m-inactive' : '';
      const duration = moment(entity.timestamp * 1000)
        .from((global ? new Date().getTime() : window.SERVER_TIMESTAMP));

      let isGroupUnique = null;

      if (durations.indexOf(duration) === -1) {
        isGroupUnique = true;
        durations.push(duration);
      }

      return (
        <MoviePreview key={key} votesFilter={0} movie={entity} className={'profile__votes-item' + inactiveClass}>
          <div className={'profile__votes-group ' + (isGroupUnique ? 'm-unique' : '')}>{duration}</div>
        </MoviePreview>
      );
    });
  }


  render() {
    const {user, votes, pending, loading, isMyPage} = this.props;

    if (pending || !user || !votes) {
      return false;
    }

    let placeholder;

    if (isMyPage) {
      placeholder = 'У вас пока нет оценок';
    } else {
      placeholder = (`${user.username || 'Пользователь'} 
      пока не ${pluralGender(user.gender, ['ставил', 'ставила', 'ставил(а)'])} оценок`);
    }

    return (
      <div className="profile">
        {super.render()}

        {votes.total
          ? <div className="profile__votes movie-prev-list">{this.renderVotes(votes)}</div>
          : (<div className="page-ph">
            <div className="page-ph__icn"><i className="icn icn_star" /></div>
            <div className="page-ph__text">{placeholder}</div>
          </div>)
        }

        {votes.total && votes.pages > votes.page
          ? <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
          : ''
        }
      </div>
    );
  }
}

ProfilePage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, votes, user, isMyPage, loading} = state.profile.toJS();
  const userSignedIn = isUserSignedIn(state);
  const loaded = state.reduxAsyncConnect.loadState.profile && state.reduxAsyncConnect.loadState.profile.loaded;

  return {pending, loaded, user, votes, isMyPage, loading, userSignedIn};
}

export default ProfilePage;