import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import './HeaderNotifications.scss';
import SidebarPanel from '../SidebarPanel/SidebarPanel';
import {isUserSignedIn, getUserModel} from '../../redux/models/user';
import {getFriendsVotes, loadVotes} from '../../redux/actions/feedActions';
import FriendsVote from '../FriendsVote/FriendsVote';
import Button from '../../components/Gui/Button';
import InviteButton from '../VkApp/InviteButton';

const propTypes = {
  dispatch           : PropTypes.func.isRequired,
  pending            : PropTypes.bool.isRequired,
  loading            : PropTypes.bool.isRequired,
  userSignedIn       : PropTypes.bool,
  newNotificationsNum: PropTypes.number,
  response           : PropTypes.any
};

class HeaderNotifications extends Component {
  constructor(props) {
    super(props);

    this.handleOpen = this.handleOpen.bind(this);
    this.handleLoadData = this.handleLoadData.bind(this);
    this.closeSidebar = this.closeSidebar.bind(this);
    this.renderVotes = this.renderVotes.bind(this);
    this.renderEmptyPage = this.renderEmptyPage.bind(this);

    this.state = {
      opened: false
    };
  }

  handleOpen() {
    this.setState({opened: true});

    this.props.dispatch(getFriendsVotes());
  }

  handleLoadData() {
    const {response, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(loadVotes(response.results.page + 1));
  }

  closeSidebar() {
    this.setState({opened: false});
  }


  renderVotes(entities) {
    return entities.map((entity, key) => {
      return (
        <FriendsVote closeSidebar={this.closeSidebar} key={key} {...entity} />
      );
    });
  }

  renderEmptyPage() {
    if (this.props.pending) {
      return false;
    }

    return (<div className="page-ph">
      <div className="page-ph__icn"><i className="icn icn_list" /></div>
      <div className="page-ph__text">Здесь будут отображаться оценки ваших друзей</div>
      <InviteButton />
    </div>);
  }

  render() {
    const {userSignedIn, response, loading, newNotificationsNum} = this.props;
    const {opened} = this.state;

    if (!userSignedIn) {
      return false;
    }

    return (
      <div className="header__right-item">
        <div className="header-notifications">
          <div
            className="header-notifications__toggle"
            onClick={this.handleOpen}
          >
            <span className="icn icn_bell" />
            {newNotificationsNum
              ? <div
                className="header-notifications__num"
              >
                {newNotificationsNum > 99 ? '99+' : newNotificationsNum}
              </div>
              : ''
            }
          </div>
          <SidebarPanel
            opened={opened}
            title="Уведомления"
            closeSidebar={this.closeSidebar}
          >
            <div className="header-notifications__list">
              {response && response.results && response.results.total
                ? this.renderVotes(response.results.entities)
                : this.renderEmptyPage()
              }
            </div>

            {response && response.results && response.results.total && response.results.pages > response.results.page ?
              <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
              : ''
            }
          </SidebarPanel>
        </div>
      </div>
    );
  }
}

HeaderNotifications.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, loading, response} = state.feed.toJS();
  const userSignedIn = isUserSignedIn(state);
  const newNotificationsNum = userSignedIn ? +getUserModel(state).get('new_notifications') : 0;

  return {pending, loading, response, userSignedIn, newNotificationsNum};
}

export default connect(mapStateToProps)(HeaderNotifications);