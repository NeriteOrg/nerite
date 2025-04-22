// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;
 
import "./CompositePriceFeed.sol";

interface IApi3ReaderProxy{
        function read() external view returns (int224 value, uint32 timestamp);
}

struct Api3Oracle {
    IApi3ReaderProxy proxy;
    uint256 stalenessThreshold;
    uint256 decimals;
}

contract pufETHPriceFeed is CompositePriceFeed {

    // pufETH/stETH feed on arbitrum.
    address public pufEthStEthOracleAddress = 0x26399f5229d893Cec6b89a3B52774d700582e1eF;
    Api3Oracle public pufEthOracle;

    constructor(address _owner, address _stEthUsdOracleAddress, address _pufEthOracleAddress, uint256 _pufEthUsdStalenessThreshold)
        CompositePriceFeed(_owner, _stEthUsdOracleAddress, _pufEthUsdStalenessThreshold)
    {
        pufEthOracle.aggregator = IApi3ReaderProxy(_pufEthOracleAddress);
        pufEthOracle.stalenessThreshold = _pufEthUsdStalenessThreshold;
        pufEthOracle.decimals = 18;

        _fetchPricePrimary();

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary();

        // Otherwise if branch is shut down and already using the lastGoodPrice, continue with it
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice(bool _isRedemption) external returns (uint256, bool) {

        if (_isRedemption && _withinDeviationThreshold(stEthUsdPrice, ethUsdPrice, STETH_USD_DEVIATION_THRESHOLD)) {
            // If it's a redemption and within 1%, take the max of (STETH-USD, ETH-USD) to mitigate unwanted redemption arb and convert to WSTETH-USD
            wstEthUsdPrice = LiquityMath._max(stEthUsdPrice, ethUsdPrice) * stEthPerWstEth / 1e18;
        } else {
            // Otherwise, just calculate WSTETH-USD price: USD_per_WSTETH = USD_per_STETH * STETH_per_WSTETH
            wstEthUsdPrice = stEthUsdPrice * stEthPerWstEth / 1e18;
        }

        // Use same price for redemption as all other ops in UNI branch
        return fetchPrice();
    }

    function _fetchPricePrimary() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (int224 pufEthStEthRateInt, uint32 pufEthStEthTimestamp) = pufEthOracle.proxy.read();
        if (pufEthStEthRateInt > 0) {
            uint256 pufEthStEthRate = uint256(pufEthStEthRateInt);
        } else {
            // if pufEth is worth more than stEth, then what? 
        }
        bool pufEthStEthOracleDown = block.timestamp - pufEthStEthTimestamp <= pufEthOracle.stalenessThreshold;
        (uint256 stEthUsdRate, bool stEthUsdOracleDown) = _getOracleAnswer(stEthUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good rsETH-USD price calculated
        if (pufEthStEthOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(pufEthStEthOracle.proxy)), true);
        if (stEthUsdOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(stEthUsdOracle.aggregator)), true);

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * underlying_per_LST
        uint256 pufEthUsdPrice = ethUsdPrice * pufEthStEthRate / 1e18;

        lastGoodPrice = pufEthUsdPrice;
        return (pufEthUsdPrice, false);
    }
}