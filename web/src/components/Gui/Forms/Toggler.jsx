import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './index.scss';

export default class Toggler extends Component {
  static propTypes = {
    checked : PropTypes.bool,
    disabled: PropTypes.bool,
    label   : PropTypes.string,
    onChange: PropTypes.func
  };

  static defaultProps = {
    onChange: () => {
    }
  };

  handleChange = () => {
    this.props.onChange();
  };

  render() {
    return (
      <label className="toggler">
        <input
          type="checkbox"
          checked={this.props.checked}
          disabled={this.props.disabled}
          onChange={this.handleChange}
        />
        <i  data-tip="hello world"/>
        {this.props.label ? (
          <span className="toggler__label">{this.props.label}</span>
        ) : null}
      </label>
    );
  }
}