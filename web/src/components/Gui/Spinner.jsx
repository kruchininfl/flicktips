import React, {Component} from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  active: PropTypes.bool,
  size  : PropTypes.string,
  additionClass: PropTypes.string
};

const defaultProps = {
  active: false
};

class Spinner extends Component {
  render() {
    const {active, size, additionClass, ...props} = this.props;

    let className = 'spinner' + (active ? ' spinner_active' : '');

    className += size ? ' spinner_size_' + size : '';
    className += additionClass ? ' ' + additionClass : '';

    return (
      <div className={className} {...props}>
        <div className="spinner__rect1">&nbsp;</div>
        <div className="spinner__rect2">&nbsp;</div>
        <div className="spinner__rect3">&nbsp;</div>
        <div className="spinner__rect4">&nbsp;</div>
        <div className="spinner__rect5">&nbsp;</div>
      </div>
    );
  }
}

Spinner.propTypes = propTypes;
Spinner.defaultProps = defaultProps;

export default Spinner;