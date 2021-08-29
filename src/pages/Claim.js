import { useState, useEffect, useReducer, useCallback, useMemo } from "react"
import styled from "styled-components"
import { ethers } from "ethers"
import { FaStop, FaPlay } from "react-icons/fa"
import BigNumber from "bignumber.js"

import Config from "../config.mjs"


const MonitorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`

const Heading = styled.div`
  width: 80%;
  max-width: 600px;
  height: 25px;
  margin: 20px 0 10px;
  font-size: 1.4rem;
  font-weight: bold;
  text-align: center;
`

const Balances = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  width: 80%;
  max-width: 300px;
  height: 200px;
  border: 1px solid black;
  border-radius: 5px;
`

const Row = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`

const Value = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50%;
  height: 50px;
  font-size: 1.4rem;
  font-weight: ${props => props.symbol ? "900" : "300"};
`

const SubHeading = styled.div`
  width: 100%;
  height: 15px;
  margin: 10px 0 5px;
  font-size: 1.2rem;
  font-style: italic;
  text-align: center;
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 500px;
  border: 1px solid black;
  border-radius: 5px;
`

const BodyValue = styled.div`
  width: 100%;
  margin: 5px 0 10px;
  font-size: 1.2rem;
  font-weight: bold;
  text-align: center;
`

const Action = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 98%;
  max-width: 490px;
  height: 50px;
  margin: 5px 0;
  border-radius: 4px;
  font-size: 1.2rem;
  cursor: ${props => props.active ? "pointer" : "default"};
  background: ${props => props.active ? "rgb(146, 180, 227)" : "#ddd"};
  box-shadow: ${props => props.active ? "0px 4px 12px #ccc" : "0"};
`

const StartStop = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 98%;
  max-width: 500px;
  height: 100px;
  margin: 10px;
  border-radius: 4px;
  cursor: ${props => props.active ? "pointer" : "default"};
  background: ${props => props.active ? "rgb(146, 180, 227)" : "#ddd"};
  box-shadow: ${props => props.active ? "0px 4px 12px #ccc" : "0"};
`

const MonitorAction = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 80%;
  max-width: 600px;
  height: 150px;
  margin-top: 20px;
  padding: 5px;
  border-radius: 5px;
  font-size: 1.4rem;
  background: #ddd;
  box-shadow: 0px 4px 12px #ccc;
  text-align: center;
`

const Footer = styled.div`
  width: 100%;
  height: 50px;
`

const Input = styled.input`
  width: 100%;
  max-width: 495px;
  height: 50px;
  margin: 5px 0;
  padding: 0;
  border: 1px solid black;
  border-radius: 4px;
  outline: none;
  font-size: 1.5rem;
  text-align: center;
  line-height: 30px;
`


export default function Claim({ connection, count }) {

  const WAIT_TIME = 1000 * (3600 + 60)  // 61 minutes, to milliseconds

  const ZERO = new BigNumber("0")
  const ONE = new BigNumber("1")
  const ONE_BILLION = new BigNumber("1000000000")


  const [ balances, setBalances ] = useState({
    base: "Please Wait ...",
    fsn: ZERO,
    free: ZERO,
    fmn: ZERO
  })
  const [ subscriptions, setSubscriptions ] = useState("Please Wait ...")


  const [ gas, dispatchGas ] = useReducer((state, gwei) => {
    return new BigNumber(gwei).multipliedBy(ONE_BILLION)
  }, ONE)



  const connect = useCallback(() => {
    const FAUCET_ABI = Config.abi
    const ERC20_ABI = Config.erc20Abi

    const provider = new ethers.providers.JsonRpcProvider(connection.provider)
    const base = ethers.Wallet.fromMnemonic(connection.phrase)
    const signer = base.connect(provider)

    let faucetAddr, freeAddr, fmnAddr
    
    if(connection.network === "mainnet") {
      faucetAddr = Config.mainnet.faucet
      freeAddr = Config.mainnet.free
      fmnAddr = Config.mainnet.fmn
    } else if(connection.network === "testnet") {
      faucetAddr = Config.testnet.faucet
      freeAddr = Config.testnet.free
      fmnAddr = Config.testnet.fmn
    }

    const faucet = new ethers.Contract(faucetAddr, FAUCET_ABI, signer)
    const free = new ethers.Contract(freeAddr, ERC20_ABI, provider)
    const fmn = new ethers.Contract(fmnAddr, ERC20_ABI, provider)

    return { provider, signer, base, faucet, free, fmn }
  }, [ connection ])


  const getBalances = useCallback(async connected => {
    const { provider, base, free, fmn } = connected

    const fsnBal = new BigNumber(ethers.utils.formatUnits(await provider.getBalance(base.address), 18))
    const freeBal = new BigNumber(ethers.utils.formatUnits(await free.balanceOf(base.address), 18))
    const fmnBal = new BigNumber(ethers.utils.formatUnits(await fmn.balanceOf(base.address), 18))

    setBalances({
      base: base.address,
      fsn: fsnBal,
      free: freeBal,
      fmn: fmnBal
    })
  }, [])


  const getSubscriptions = useCallback(async connected => {
    const { faucet } = connected
    const BATCH = 6 * 13
    const totalRequests = count

    let batches = []
    let requests = []

    for(let i = 0; i < totalRequests; i++) {
      if(requests.length === BATCH || i === totalRequests - 1) {
        batches.push(requests)
        requests = []
      }
      let current = ethers.Wallet.fromMnemonic(connection.phrase, `m/44'/60'/0'/0/${ i }`)
      requests.push(faucet.isSubscribed(current.address))
    }

    console.log(`
      Batches: ${ batches }
    `)

    let subCount = 0
    let currentBatch = 0

    const checkSubscribersInterval = setInterval(async () => {
      if(currentBatch < batches.length) {
        let check = currentBatch
        currentBatch++
        let results = await Promise.all(batches[check])
        subCount += (results.filter(res => res === true)).length

        if(currentBatch === batches.length) setSubscriptions(subCount)
      } else {
        clearInterval(checkSubscribersInterval)
      }
    }, 15000)
  }, [ connection, count ])



  useEffect(() => {
    const connected = connect()
    if(balances.base === "Please Wait ...") {
      getBalances(connected)
    } else if(subscriptions === "Please Wait ...") {
      getSubscriptions(connected)
    }
  }, [ connect, getSubscriptions, getBalances, balances, subscriptions ])



  return (
    <MonitorContainer>
      <Heading>
        Balances
      </Heading>
      <Balances>
        <Row>
          <Value symbol={ true }>
            FSN
          </Value>
          <Value>
            { balances.fsn.toFixed(4) }
          </Value>
        </Row>
        <Row>
          <Value symbol={ true }>
            FREE
          </Value>
          <Value>
            { balances.free.toFixed(4) }
          </Value>
        </Row>
        <Row>
          <Value symbol={ true }>
            FMN
          </Value>
          <Value>
            { balances.fmn.toFixed(4) }
          </Value>
        </Row>
      </Balances>
      <Heading>
        My Bot Army
      </Heading>
      <Body>
        <SubHeading>
          Base Address
        </SubHeading>
        <BodyValue>
          { balances.base }
        </BodyValue>
        <SubHeading>
          Total Bots
        </SubHeading>
        <BodyValue>
          { count }
        </BodyValue>
        <SubHeading>
          Subscribed Bots
        </SubHeading>
        <BodyValue>
          { subscriptions }
        </BodyValue>
        <Action>
          Subscribe All
        </Action>
      </Body>
      <Heading>
        Gas Price (gwei)
      </Heading>
      <Input type="number" min="1" defaultValue={ gas.toNumber() } onChange={e => {
        dispatchGas(e.target.value)
      }}/>
      <Heading>
        Start/Stop Claiming
      </Heading>
      <Body>
        <Row>
          <StartStop>
          </StartStop>
        </Row>
      </Body>
      <MonitorAction>
      </MonitorAction>
      <Footer/>
    </MonitorContainer>
  )
}