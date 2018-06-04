import React, {Component} from 'react';
import Button from 'components/Gui/Button';
import Spinner from 'components/Gui/Spinner';

// import './LayoutPage.scss';

class LayoutPage extends Component {
  constructor() {
    super();

    this.handleBtnClick = this.handleBtnClick.bind(this);

    this.state = {
      loadingBtn: null
    };
  }

  handleBtnClick(btnIndex) {
    this.setState({loadingBtn: this.state.loadingBtn === btnIndex ? null : btnIndex});
  }

  render() {
    return (
      <div className="layout-page">
        <h1>Buttons</h1>
        <Button loading={this.state.loadingBtn === 1} onClick={this.handleBtnClick.bind(this, 1)}>Button</Button>
        <Button loading={this.state.loadingBtn === 2} onClick={this.handleBtnClick.bind(this, 2)} color="gray">Button</Button>
        <Button loading={this.state.loadingBtn === 3} onClick={this.handleBtnClick.bind(this, 3)} color="green">Button</Button>
        <Button loading={this.state.loadingBtn === 4} onClick={this.handleBtnClick.bind(this, 4)} color="blue">Button</Button>
        <Button disabled>Button</Button>
        <br />
        <Button loading={this.state.loadingBtn === 5} onClick={this.handleBtnClick.bind(this, 5)}  size="big">Button</Button>

        <h1>Spinners</h1>
        <Spinner active/><span style={{marginLeft: 5, marginRight: 10}}>- стандартный спинер</span>
        <Spinner active size="small"/><span style={{marginLeft: 5, marginRight: 10}}>- маленький спинер</span>

        <h1>Form</h1>
        <div className="fc">
          <label className="fc__label" htmlFor="input-1">Label:</label>
          <input id="input-1" type="text" className="fc__input" placeholder="Placeholder" />
        </div>
        <div className="fc">
          <label className="fc__label" htmlFor="input-2">Label:</label>
          <input id="input-2" type="text" className="fc__input" placeholder="Placeholder" disabled readOnly />
        </div>
        <div className="fc">
          <label className="fc__label" htmlFor="input-3">Label:</label>
          <input id="input-3" type="text" className="fc__input" value="Value" disabled readOnly />
        </div>
        <br />
        <div className="fc">
          <label htmlFor="select-1" className="fc__label">Label:</label>
          <select name="select-1" id="select-1" className="fc__select">
            <option value="1">Item 1</option>
            <option value="2">Item 2</option>
            <option value="3">Item 3</option>
            <option value="4">Item 4</option>
            <option value="5">Item 5</option>
          </select>
        </div>
        <div className="fc">
          <label htmlFor="select-1" className="fc__label">Label:</label>
          <select name="select-1" id="select-1" className="fc__select" disabled>
            <option value="1">Item 1</option>
            <option value="2">Item 2</option>
            <option value="3">Item 3</option>
            <option value="4">Item 4</option>
            <option value="5">Item 5</option>
          </select>
        </div>
        <br />
        <div className="fc">
          <input className="fc__checkbox" type="checkbox" id="checkbox-1" value="1" />
          <label htmlFor="checkbox-1" className="fc__label">Checkbox</label>
        </div>
        <div className="fc">
          <input className="fc__checkbox" type="checkbox" id="checkbox-2" value="1" checked readOnly />
          <label htmlFor="checkbox-2" className="fc__label">Checkbox</label>
        </div>
        <div className="fc">
          <input className="fc__checkbox" type="checkbox" id="checkbox-3" value="1" disabled readOnly />
          <label htmlFor="checkbox-3" className="fc__label">Checkbox</label>
        </div>
        <div className="fc">
          <input className="fc__checkbox" type="checkbox" id="checkbox-4" value="1" checked disabled readOnly />
          <label htmlFor="checkbox-4" className="fc__label">Checkbox</label>
        </div>
        <br />
        <div className="fc">
          <input className="fc__radio" name="radio" type="radio" id="radio-1" value="1" />
          <label htmlFor="radio-1" className="fc__label">Radio</label>
        </div>
        <div className="fc">
          <input className="fc__radio" name="radio" type="radio" id="radio-2" value="1" checked readOnly />
          <label htmlFor="radio-2" className="fc__label">Radio</label>
        </div>
        <div className="fc">
          <input className="fc__radio" name="radio" type="radio" id="radio-3" value="1" disabled readOnly />
          <label htmlFor="radio-3" className="fc__label">Radio</label>
        </div>
        <div className="fc">
          <input className="fc__radio" name="radio" type="radio" id="radio-4" value="1" checked disabled readOnly />
          <label htmlFor="radio-4" className="fc__label">Radio</label>
        </div>
      </div>
    );
  }
}

export default LayoutPage;