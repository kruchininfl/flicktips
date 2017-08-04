import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import './HeaderNotifications.scss';
import SidebarPanel from '../SidebarPanel/SidebarPanel';
import {isUserSignedIn} from '../../redux/models/user';
import {getFriendsVotes, loadVotes} from '../../redux/actions/feedActions';
import FriendsVote from '../FriendsVote/FriendsVote';
import Button from '../../components/Gui/Button';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  pending     : PropTypes.bool.isRequired,
  loading     : PropTypes.bool.isRequired,
  userSignedIn: PropTypes.bool,
  response    : PropTypes.any
};

class HeaderNotifications extends Component {
  constructor(props) {
    super(props);

    this.handleOpen = this.handleOpen.bind(this);
    this.handleLoadData = this.handleLoadData.bind(this);
    this.closeSidebar = this.closeSidebar.bind(this);

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


  static renderVotes(entities) {
    return entities.map((entity, key) => {
      return (
        <FriendsVote key={key} {...entity} />
      );
    });
  }

  static renderEmptyPage() {
    return (<div className="page-ph">
      <div className="page-ph__icn"><i className="icn icn_list"/></div>
      <div className="page-ph__text">Ваша лента пока пуста</div>
    </div>);
  }

  render() {
    const {userSignedIn, response, loading} = this.props;
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
          </div>
          <SidebarPanel
            opened={opened}
            title="Уведомления"
            closeSidebar={this.closeSidebar}
          >
            <div className="header-notifications__list">
              {response && response.results && response.results.total
                ? HeaderNotifications.renderVotes(response.results.entities)
                : HeaderNotifications.renderEmptyPage()
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

  return {pending, loading, response, userSignedIn};
}

export default connect(mapStateToProps)(HeaderNotifications);