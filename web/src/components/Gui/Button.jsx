import React, {Component} from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';
import Spinner from 'components/Gui/Spinner';
import {Link} from 'react-router';

const propTypes = {
  children      : PropTypes.node,
  dfClass       : PropTypes.string,
  disabled      : PropTypes.bool,
  loading       : PropTypes.bool,
  onClick       : PropTypes.func,
  componentClass: elementType,
  to            : PropTypes.string,
  additionClass : PropTypes.string,
  color         : PropTypes.string,
  icn           : PropTypes.string,
  size          : PropTypes.string
};

const defaultProps = {
  dfClass       : 'btn',
  disabled      : false,
  loading       : false,
  componentClass: 'span'
};

class Button extends Component {
  render() {
    const {dfClass, disabled, loading, color, size, componentClass, additionClass, icn, ...props} = this.props;
    let className = dfClass;

    className += additionClass ? ' ' + additionClass : '';
    className += disabled ? ' ' + dfClass + '_disabled' : '';
    className += loading ? ' ' + dfClass + '_loading' : '';
    className += color ? ' ' + dfClass + '_color_' + color : '';
    className += size ? ' ' + dfClass + '_size_' + size : '';

    const Node = props.to ? Link : componentClass;

    return (
      <Node className={className} {...props} >
        <span className={dfClass + '__inn'}>
          {icn ? <span className={'icn icn_' + icn + ' ' + dfClass + '__icn'}>&nbsp;</span> : ''}
          <span className={dfClass + '__text'}>{this.props.children}</span>
        </span>
        <Spinner additionClass={dfClass + '__spinner'} active={loading} size="small"/>
      </Node>);
  }
}

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;

export default Button;