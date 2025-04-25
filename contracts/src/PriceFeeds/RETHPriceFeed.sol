// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TokenPriceFeedBase.sol";
import "../Interfaces/IRETHToken.sol";
import "../Interfaces/IRETHPriceFeed.sol";

// import "forge-std/console2.sol";

contract RETHPriceFeed is TokenPriceFeedBase, IRETHPriceFeed {
    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _rEthEthOracleAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _rEthEthStalenessThreshold
    ) TokenPriceFeedBase(_owner, _ethUsdOracleAddress, _ethUsdStalenessThreshold) {
        // Store RETH-ETH oracle
        rEthEthOracle.aggregator = AggregatorV3Interface(_rEthEthOracleAddress);
        rEthEthOracle.stalenessThreshold = _rEthEthStalenessThreshold;
        rEthEthOracle.decimals = 18;

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    Oracle public rEthEthOracle;

    uint256 public constant RETH_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function fetchPrice() public returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(tokenUsdOracle);
        (uint256 rEthEthPrice, bool rEthEthOracleDown) = _getOracleAnswer(rEthEthOracle);

        // If either the ETH-USD feed or exchange rate is down, shut down and switch to the last good price
        // seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator)), true);
        }
        // If the ETH-USD feed is live but the RETH-ETH oracle is down, shutdown and substitute RETH-ETH with the canonical rate
        if (rEthEthOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(rEthEthOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 rEthUsdPrice = ethUsdPrice * rEthEthPrice / 1e18;

        lastGoodPrice = rEthUsdPrice;

        return (rEthUsdPrice, false);
    }

    function fetchRedemptionPrice() public returns (uint256, bool) {
        return fetchPrice();
    }
}
