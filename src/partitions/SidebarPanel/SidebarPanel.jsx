import React, {Component} from 'react';
import PropTypes from 'prop-types';
// import ScrollLock from 'react-scrolllock';

import './SidebarPanel.scss';

const propTypes = {
  opened      : PropTypes.bool,
  title       : PropTypes.string,
  children    : PropTypes.node,
  closeSidebar: PropTypes.func
};

class SidebarPanel extends Component {
  constructor(props) {
    super(props);

    this.handleClose = this.handleClose.bind(this);
  }

  handleClose() {
    this.props.closeSidebar();
  }

  render() {
    const {opened} = this.props;

    return (
      <div className={'sidepanel' + (opened ? ' m-opened' : '')}>
        <div
          onClick={this.handleClose}
          className="sidepanel__overlay overlay"
        />

        <div className="sidepanel__wrap">
          <div className="sidepanel__inn">
            <div className="sidepanel__head">
              {this.props.title ? <div className="sidepanel__head-title">{this.props.title}</div> : ''}
              <span
                onClick={this.handleClose}
                className="sidepanel__head-close"
              >
                <i className="icn icn_cross" />
              </span>
            </div>
            <div className="sidepanel__content">
              {this.props.children}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

SidebarPanel.propTypes = propTypes;

export default SidebarPanel;