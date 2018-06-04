import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {Scrollbars} from 'react-custom-scrollbars';

const propTypes = {
  children: PropTypes.node
};

class CustomScrollbars extends Component {
  render() {
    return (
      <Scrollbars
        universal
        className="scrollbar"
        renderTrackHorizontal={props => <div {...props} className="scrollbar__horizontal" />}
        renderTrackVertical={props => <div {...props} className="scrollbar__vertical" />}
        renderThumbHorizontal={props => <div {...props} className="scrollbar__thumb-horizontal" />}
        renderThumbVertical={props => <div {...props} className="scrollbar__thumb-vertical" />}
      >
        {this.props.children}
      </Scrollbars>
    );
  }
}

CustomScrollbars.propTypes = propTypes;

export default CustomScrollbars;