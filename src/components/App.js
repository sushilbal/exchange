import React, { Component } from "react";
import { loadToken, loadExchange } from '../interactions';
import getWeb3 from "../getWeb3";

import "../App.css";

class App extends Component {
  state = { storageValue: 0, web3: null, accounts: null, contract: null };

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();
      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();
      // Get the contract instance.
      const networkId = await web3.eth.net.getId();
      const token = loadToken(web3, networkId);
      const exchange = loadExchange(web3, networkId);
      const owner = await exchange.methods.pauser().call();
      
      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.setState({
        web3,
        accounts,
        owner,
        contract: [token, exchange]
      }, this.runExample);
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  };

  runExample = async () => {
    const { accounts, contract } = this.state;

    const totalSupply = await contract[0].methods.totalSupply().call();

    // Update state with the result.
    this.setState({
      totalSupply: totalSupply
    });
    this.refreshBalance(accounts[0]);
    this.getOrderEvents();
  };

  sendToken = async () => {
    const { web3, accounts, contract, owner } = this.state;
    let amount = web3.utils.toWei('100', 'ether');
    const receiver = document.getElementById("receiver").value;
    await contract[0].methods.transfer(receiver, amount).send({ from: owner });
    this.setState({
      status: 'Transaction complete!'
    })
    this.refreshBalance(accounts[0]);
    this.getOrderEvents();
  }

  refreshBalance = async function (address) {

    const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';
    const { contract, web3, accounts } = this.state;
    let tokenBalance = await contract[0].methods.balanceOf(address).call();
    let etherBalance = await web3.eth.getBalance(accounts[0]);
    etherBalance = web3.utils.fromWei(etherBalance, 'ether');
    tokenBalance = web3.utils.fromWei(tokenBalance, 'ether');
    let tokenBalanceInExchange = await contract[1].methods.tokens(contract[0].options.address, accounts[0]).call();
    let etherBalanceInExchange = await contract[1].methods.tokens(ETHER_ADDRESS, accounts[0]).call();


    etherBalanceInExchange = web3.utils.fromWei(etherBalanceInExchange, 'ether');
    tokenBalanceInExchange = web3.utils.fromWei(tokenBalanceInExchange, 'ether');

    this.setState({
      tokenBalance: tokenBalance,
      etherBalance: etherBalance,
      tokenBalanceInExchange: tokenBalanceInExchange,
      etherBalanceInExchange: etherBalanceInExchange
    });
  }


  approveToken = async () => {
    const { web3, accounts, contract } = this.state;
    let approveTokenAmount = document.getElementById("approveAmount").value;
    approveTokenAmount = web3.utils.toWei(approveTokenAmount, 'ether');
    
    await contract[0].methods.approve(contract[1].options.address, approveTokenAmount).send({ from: accounts[0] });

  }

  depositToken = async () => {
    const { web3, accounts, contract } = this.state;
    let depositTokenAmount = document.getElementById("depositAmount").value;
    depositTokenAmount = web3.utils.toWei(depositTokenAmount, 'ether');
    await contract[1].methods.depositToken(contract[0].options.address, depositTokenAmount).send({ from: accounts[0] });
    
    this.refreshBalance(accounts[0]);
  }

  depositEther = async () => {
    const { web3, accounts, contract } = this.state;
    let depositEtherAmount = document.getElementById("depositEther").value;
    depositEtherAmount = web3.utils.toWei(depositEtherAmount, 'ether');
    await contract[1].methods.depositEther().send({ from: accounts[0], value: depositEtherAmount });
    if (true) {

    } else {
      alert('Please approve before making a deposit in the exchange.')
    }
    this.refreshBalance(accounts[0]);
  }

  makeBuyOrder = async () => {
    let ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';
    const { web3, accounts, contract } = this.state;
    let makeOrderEtherAmount = document.getElementById("makeOrderEtherAmount").value;
    let makeOrderTokenAmount = document.getElementById("makeOrderTokenAmount").value;
    makeOrderTokenAmount = web3.utils.toWei(makeOrderTokenAmount, 'ether');
    makeOrderEtherAmount = web3.utils.toWei(makeOrderEtherAmount, 'ether');
    await contract[1].methods.makeOrder(contract[0].options.address, makeOrderTokenAmount,
      ETHER_ADDRESS, makeOrderEtherAmount)
      .send({ from: accounts[0] });
    
    this.setState({
      orderStatus: 'Transaction complete!'
    })
    this.refreshBalance(accounts[0]);
    this.getOrderEvents();
  }

  submitOrder = async () => {
    let id= document.getElementById("orderSubmitId").value;
    
    const { accounts, contract } = this.state;
    await contract[1].methods.fillOrder(id).send({ from: accounts[0] });
    this.setState({
      orderFilledStatus: 'Transaction complete!'
    })
    this.refreshBalance(accounts[0]);
  }


  loadAllOrders = async () => {
    const { contract } = this.state;
    let exchange = contract[1];
    // Fetch cancelled orders with the "Cancel" event stream
    const cancelStream = await exchange.getPastEvents('Cancel', { fromBlock: 0, toBlock: 'latest' })
    // Format cancelled orders
    const cancelledOrders = cancelStream.map((event) => event.returnValues)
    // Add cancelled orders to the redux store


    // Fetch filled orders with the "Trade" event stream
    const tradeStream = await exchange.getPastEvents('Trade', { fromBlock: 0, toBlock: 'latest' })
    // Format filled orders
    const filledOrders = tradeStream.map((event) => event.returnValues)
    // Add cancelled orders to the redux store


    // Load order stream
    const orderStream = await exchange.getPastEvents('Order', { fromBlock: 0, toBlock: 'latest' })
    // Format order stream
    const allOrders = orderStream.map((event) => event.returnValues)
    // Add open orders to the redux store

    this.setState({
      cancelledOrders: cancelledOrders,
      filledOrders: filledOrders,
      allOrders: allOrders
    })
  }

  checkOrderStatus = async () => {
    const { contract } = this.state;
    let exchange = contract[1];
    let orderCount = await exchange.methods.orderCount().call();
    let validOrderIds;
    let count = 0;
    for (let i = 0; i < orderCount; i++) {
      let isCancelled = await exchange.methods.orderCancelled(i).call();
      let isFilled = await exchange.methods.orderFilled(i).call();
      if (!isFilled && !isCancelled) {
        validOrderIds[count] = i;
        count++;
      }
    }
    
    this.setState({
      validOrderIds: validOrderIds
    });
  }

  getTokenTransferClassName = () => {
    const { accounts, owner } = this.state;
    if (accounts[0] === owner) {
      return 'showDiv';
    }
    return 'hideDiv';
  }

  pauseExchange = async ()=>{
    const {contract,accounts} = this.state;
    await contract[1].methods.pause().send({ from: accounts[0]});
  }

  unPauseExchange = async ()=>{
    const {contract,accounts} = this.state;
    await contract[1].methods.unpause().send({ from: accounts[0]});
  }

  getOrderEvents = async () => {
    const { contract,web3 } = this.state;
    const orderStream = await contract[1].getPastEvents('Order', { fromBlock: 0, toBlock: 'latest' });
    // Format order stream
    let allOrders = orderStream.map((event) => event.returnValues);
    let orderEvents=[];
    for (var i=0;i< allOrders.length;i++){
     
      let cancelled = await contract[1].methods.orderCancelled(allOrders[i].id).call();
      let filled = await contract[1].methods.orderFilled(allOrders[i].id).call();
     
      if (!cancelled && !filled) {
        let amountGet=web3.utils.fromWei(allOrders[i].amountGet,'ether');
        let amountGive=web3.utils.fromWei(allOrders[i].amountGive,'ether');
        let id=allOrders[i].id;
      let order=<li key={id}>Created by {allOrders[i].user}, need {amountGet} Tokens and will pay {amountGive} ether. Order ID = {id}</li>
        
        orderEvents.push(order);
      }
    }
    
    if (orderEvents.length > 0) {
      this.setState({
        orderEvents: orderEvents
      });
    }
  }
  render() {
    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <h1>Good to Go!</h1>
        <div>
          <div><div>Need Some Tokens - Make a deposit of Ether and create an order.</div></div>
          <div>
            <div className={this.getTokenTransferClassName()} >
              <label htmlFor="receiver">To address:</label>
              <input type="text" id="receiver" placeholder="e.g. 0x93e66d9baea28c17d9fc393b53e3fbdd76899dae" />
              <button className="button" onClick={this.sendToken}>I need 100 Tokens</button>
            </div>

          </div>
          <div>
            <div>
              <div>My Token Balance is: {this.state.tokenBalance} and my Ether Balance is {this.state.etherBalance}</div>
            </div>
            
          </div>
          <div>
            <p id="status">{this.state.status}</p>
          </div>
          <div className={this.getTokenTransferClassName()} >
            Pause the Exchange : <button className="button" onClick={this.pauseExchange}>Pause</button> 
            UnPause the Exchange : <button className="button" onClick={this.unPauseExchange}>Unpause</button>
          </div>
        </div>
        <hr />
        <div>
          <h2>Deposit Token/Ether in Exchange</h2>
              <div >
                <label htmlFor="approve_token">Approve Token :</label>
                <input type="text" id="approveAmount" placeholder="e.g. 95" />
                <button className="button" onClick={this.approveToken}>Approve Token</button>

                <label htmlFor="deposit_token">Deposit Token :</label>
                <input type="text" id="depositAmount" placeholder="e.g. 95" />
                <button className="button" onClick={this.depositToken}>Deposit Token</button>


                <label htmlFor="deposit_token">Deposit Ether :</label>
                <input type="text" id="depositEther" placeholder="e.g. 95" />
                <button className="button" onClick={this.depositEther}>Deposit Ether</button>
              </div>
              
              <div>My Token Balance in Exchange is: {this.state.tokenBalanceInExchange} and my Ether Balance in Exchange is {this.state.etherBalanceInExchange}</div>
            
        </div>
        <hr />
        <div>
          <div>
            <h2>Create Order in Exchange</h2>
            <label htmlFor="make_order">Specify the Ether amount
            <input type="text" id="makeOrderEtherAmount" placeholder="e.g. 95" />
              you want to pay whoever transfers the
               <input type="text" id="makeOrderTokenAmount" placeholder="e.g. 95" />
              amount of Tokens you need.</label>
            <button className="button" onClick={this.makeBuyOrder}>Make Order</button>
          </div>
          <div><p id="status">{this.state.orderStatus}</p></div>
          <hr></hr>
          <div>
            <div>
              <h2>All Orders</h2>
            </div>
            <div>
              <ul>
                {this.state.orderEvents}
              </ul>
            </div>
            <hr></hr>
          </div>
          <div>
            <h2>Complete the Trade for Below Open Orders</h2>
              <label>Select a order number from above and click Submit</label>
              <input type="number" id="orderSubmitId"/>
              <button className="button" onClick={this.submitOrder}>Submit Order</button>
          </div>
          <div><p id="status">{this.state.orderFilledStatus}</p></div>
          
        </div>
      </div>

    );
  }
}

export default App;
