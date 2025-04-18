// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;
 
import "./CompositePriceFeed.sol";

contract rsETHPriceFeed is CompositePriceFeed {

    //BTC feed on arbitrum.
    address public rsEthOracleAddress = 0xb0EA543f9F8d4B818550365d13F66Da747e1476A;
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

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // Use same price for redemption as all other ops in tBTC branch

        //get the price of normal rsETH in eth. 
        int256 rsEthPriceInt;
        (,rsEthPriceInt,,,) = AggregatorV3Interface(rsEthOracleAddress).latestRoundData();
        uint256 rsEthPrice = uint256(rsEthPriceInt); // Convert from int256 to uint256
        //compare tbtc price. 
        (uint256 rsEthPrice, bool resultDown) = fetchPrice();
        //if they are within 2% then there is no depeg. Use the higher one of the two to prevent value leak.
        // Instead of comparing tbtcPrice/btcPrice with fractions, cross-multiply.
        if (rsEthPrice * 100 <= rsEthPrice * 102 && rsEthPrice * 100 >= rsEthPrice * 98) {
            //no depeg. return the higher one.
            if( rsEthPrice > rsEthPrice) {
                return (rsEthPrice, resultDown); 
            } else {
                return (btcPrice, resultDown);
            }
        } else {
            //depeg is significant. 
            return (tbtcPrice, resultDown);
        }
    }

    //  _fetchPricePrimary returns:
    // - The price
    // - A bool indicating whether a new oracle failure was detected in the call
    function _fetchPricePrimary(bool /* _isRedemption */ ) internal virtual returns (uint256, bool) {
        return _fetchPricePrimary();
    }

    function _fetchPricePrimary() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 rsEthPrice, bool rsEthOracleDown) = _getOracleAnswer(rsEthOracle);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good rsETH-USD price calculated
        if (rsEthOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(rsEthOracle.aggregator)), true);
        if (ethUsdOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * underlying_per_LST
        uint256 lstUsdCanonicalPrice = _ethUsdPrice * lstRate / 1e18;

        lastGoodPrice = lstUsdCanonicalPrice;
        return (lstUsdCanonicalPrice, false);
    }
}