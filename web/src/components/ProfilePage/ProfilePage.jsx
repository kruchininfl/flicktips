import React from 'react';
import PropTypes from 'prop-types';
import {asyncConnect}  from 'redux-connect';
import {getProfile, resetProfile, loadVotes} from 'redux/actions/profileActions';
import MoviePreview from 'partitions/MoviePreview';
import {pluralGender} from 'helpers';
import moment from 'moment';
import 'moment/locale/ru';
import Button from 'components/Gui/Button';
import ProfileLayout from './ProfileLayout';

const propTypes = {
  dispatch: PropTypes.func,
  pending : PropTypes.bool,
  loaded  : PropTypes.bool,
  loading : PropTypes.bool,
  params  : PropTypes.any,
  isMyPage: PropTypes.bool,
  user    : PropTypes.any,
  votes   : PropTypes.any
};

@asyncConnect([
  {
    key: 'profile',
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
    if (this.props.loaded) {
      return false;
    }

    this.props.dispatch(getProfile(this.props.params && this.props.params.id ? this.props.params.id : null));
  }

  componentWillUnmount() {
    this.props.dispatch(resetProfile());
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

      let group = null;

      if (durations.indexOf(duration) === -1) {
        group = duration;
        durations.push(duration);
      }

      return (
        <div key={key}>
          {
            group ?
              <div className="profile__votes-group">{group}</div>
              : ''
          }
          <div className={'profile__votes-item' + inactiveClass}>
            <MoviePreview
              dispatch={this.props.dispatch}
              id={entity.id}
              vote={!this.props.isMyPage ? entity.vote : null}
              image={entity.tmdb_poster_path}
              title={entity.title}
              originalTitle={entity.original_title}
              genres={entity.genres ? entity.genres.map((el) => el.name) : []}
              date={entity.release_date || entity.first_air_date}
              likes={entity.likes}
              dislikes={entity.dislikes}
              neutral={entity.neutral}
              isLiked={entity.isLiked}
              isDisliked={entity.isDisliked}
              isNeutral={entity.isNeutral}
              inBookmarks={entity.inBookmarks}
            />
          </div>
        </div>
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
      placeholder = 'Вы пока ничего не оценивали';
    } else {
      placeholder = (`${user.username || 'Пользователь'} 
      пока ничего не ${pluralGender(user.gender, ['оценил', 'оценила', 'оценил(а)'])}`);
    }

    return (
      <div className="profile">
        {super.render()}

        {votes.total
          ? <div className="profile__votes">{this.renderVotes(votes)}</div>
          : (<div className="page-ph">
            <div className="page-ph__icn"><i className="icn icn_star" /></div>
            <div className="page-ph__text">{placeholder}</div>
          </div>)
        }

        {votes.total && votes.pages > votes.page ?
          <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
          : ''
        }
      </div>
    );
  }
}

ProfilePage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, votes, user, isMyPage, loading} = state.profile.toJS();
  const loaded = state.reduxAsyncConnect.loadState.profile && state.reduxAsyncConnect.loadState.profile.loaded;

  return {pending, loaded, user, votes, isMyPage, loading};
}

export default ProfilePage;