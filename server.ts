import express from 'express';
import dotenv from 'dotenv';
import { SecretNetworkClient } from "secretjs";
import BigNumber from 'bignumber.js';

export const SECRET_CHAIN_ID = "secret-4"
export const SECRET_LCD = "https://lcd.mainnet.secretsaturn.net"

dotenv.config();


const app = express();
const PORT = process.env.PORT || 3001;

app.get('/circulatingsupply', async (req, res) => {

    const ecosystemPoolAddresses = [
        "secret1dcn8a9t5r7meas37ra2qgtr6rqae997u3x3lpl",
        "secret1qx3trqprk3780xqnwfurdeq2dtag0cvrw8whq8"
    ];

    const secretjsquery = new SecretNetworkClient({
      url: SECRET_LCD,
      chainId: SECRET_CHAIN_ID,
  });

  try {
      const supplyResult = await secretjsquery?.query?.bank?.supplyOf({ denom: "uscrt" });
      const totalSupply = (supplyResult?.amount?.amount as any) / 1e6;

      const ecosystemPoolDataPromises = ecosystemPoolAddresses.map(async (address) => {
        // Fetch liquid balance
        const resBalance = await secretjsquery?.query?.bank?.balance({
            address: address,
            denom: "uscrt",
        });
        const liquidBalance = Number(resBalance.balance?.amount) / 1e6;
        
        // Fetch staked SCRT
        const stakedBalance = await calculateStakedSCRT(secretjsquery, address);
        
        return {
            address,
            liquidBalance,
            stakedBalance,
        };
    });

    const ecosystemPoolData = await Promise.all(ecosystemPoolDataPromises);

    const ecosystemPoolTotalBalance = ecosystemPoolData.reduce((acc, data) => {
       return acc + data.liquidBalance + data.stakedBalance;
    }, 0);

    const communtyPoolQuery = await secretjsquery?.query?.distribution?.communityPool('')
    const communityPoolSupply = Number((communtyPoolQuery?.pool!)[1].amount) / 1e6;
    const circulatingSupply = totalSupply - ecosystemPoolTotalBalance - communityPoolSupply;

    
    // const results = [
    //       { "totalSupply": totalSupply },
    //       { "ecosystemPoolTotalBalance": ecosystemPoolTotalBalance },
    //       { "circulatingSupply": circulatingSupply }
    // ];
    //   res.json(results);

    res.send(circulatingSupply.toString())

  } catch (error) {
      console.error("Error querying data:", error);
      res.status(500).send("Internal Server Error");
  }
});

app.get('/totalsupply', async (req, res) => {
    const secretjsquery = new SecretNetworkClient({
        url: SECRET_LCD,
        chainId: SECRET_CHAIN_ID,
    });
    try {
      const supplyResult = await secretjsquery?.query?.bank?.supplyOf({ denom: "uscrt" });
      const totalSupply = (supplyResult?.amount?.amount as any) / 1e6;

     res.send(totalSupply.toString())
  } catch (error) {
      console.error("Error querying data:", error);
      res.status(500).send("Internal Server Error");
  }
});

async function calculateStakedSCRT(secretjsquery: any, delegatorAddress: any) {
  // Fetch delegator delegations
  const delegatorDelegations = await secretjsquery?.query?.staking.delegatorDelegations({
      delegator_addr: delegatorAddress,
      pagination: { limit: "1000" },
  });

  // Sum up all the delegations
  const totalStakedSCRT = delegatorDelegations.delegation_responses
      ?.reduce((sum: any, delegation: any) => {
          const amount = new BigNumber(delegation?.balance?.amount || 0);
          return sum.plus(amount);
      }, new BigNumber(0))
      .dividedBy('1e6');
      
  return Number(totalStakedSCRT);
}

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
