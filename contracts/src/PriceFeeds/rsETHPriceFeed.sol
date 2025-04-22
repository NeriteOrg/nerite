// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;
 
import "./CompositePriceFeed.sol";

contract rsETHPriceFeed is CompositePriceFeed {

    //BTC feed on arbitrum.
    address public rsEthOracleAddress = 0x8fE61e9D74ab69cE9185F365dfc21FC168c4B56c;
    Oracle public rsEthOracle;

    constructor(address _owner, address _ethUsdOracleAddress, address _rsEthOracleAddress, uint256 _rsEthUsdStalenessThreshold)
        CompositePriceFeed(_owner, _ethUsdOracleAddress, _rsEthUsdStalenessThreshold)
    {
        rsEthOracle.aggregator = AggregatorV3Interface(_rsEthOracleAddress);
        rsEthOracle.stalenessThreshold = _rsEthUsdStalenessThreshold;
        rsEthOracle.decimals = 18;

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
        (uint256 rsEthPrice, bool rsEthOracleDown) = _getOracleAnswer(rsEthOracle);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good rsETH-USD price calculated
        if (rsEthOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(rsEthOracle.aggregator)), true);
        if (ethUsdOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * underlying_per_LST
        uint256 rsEthUsdPrice = ethUsdPrice * rsEthRate / 1e18;

        lastGoodPrice = rsEthUsdPrice;
        return (rsEthUsdPrice, false);
    }
}