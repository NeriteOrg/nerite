// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TokenPriceFeedBase.sol";
import "../Interfaces/IWSTETH.sol";
import "../Interfaces/IWSTETHPriceFeed.sol";

// import "forge-std/console2.sol";

interface IWSTETH_Provider {
    function getRate() external view returns (uint256);
}

contract WSTETHPriceFeed is IWSTETHPriceFeed, TokenPriceFeedBase {
    Oracle public wstEthStethOracle;
    address public wStETHStEthOracle = 0xB1552C5e96B312d0Bf8b554186F846C40614a540;

    uint256 public constant STETH_USD_DEVIATION_THRESHOLD = 1e16; // 1%

    constructor(
        address _owner,
        address _stEthUsdOracleAddress,
        address _wstEthStEthOracleAddress,
        uint256 _stEthUsdStalenessThreshold,
        uint256 _wstEthStEthStalenessThreshold
    ) TokenPriceFeedBase(_owner, _stEthUsdOracleAddress, _stEthUsdStalenessThreshold) {
        wstEthStethOracle.aggregator = AggregatorV3Interface(_wstEthStEthOracleAddress);
        wstEthStethOracle.stalenessThreshold = _wstEthStEthStalenessThreshold;
        wstEthStethOracle.decimals = wstEthStethOracle.aggregator.decimals();
        
        priceSource = PriceSource.primary;
        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function stEthUsdOracle() external view returns (AggregatorV3Interface, uint256, uint8) {
        return (tokenUsdOracle.aggregator, tokenUsdOracle.stalenessThreshold, tokenUsdOracle.decimals);
    }

    function fetchPrice() external returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 stEthPerWstEth, bool stEthPerWstEthOracleDown) = _getOracleAnswer(wstEthStethOracle);
        (uint256 stEthUsdPrice, bool stEthUsdOracleDown) = _getOracleAnswer(tokenUsdOracle);

        // - If exchange rate or ETH-USD is down, shut down and switch to last good price. Reasoning:
        // - Exchange rate is used in all price calcs
        // - ETH-USD is used in the fallback calc, and for redemptions in the primary price calc
        if (stEthPerWstEthOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(wstEthStethOracle.aggregator)), true);
        }
        // If the STETH-USD feed is down, shut down and try to substitute it with the ETH-USD price
        if (stEthUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(wstEthStethOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:
        uint256 wstEthUsdPrice = stEthUsdPrice * stEthPerWstEth / 1e18;

        lastGoodPrice = wstEthUsdPrice;

        return (wstEthUsdPrice, false);
    }
}
