// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TokenPriceFeedBase.sol";
import "../Interfaces/IPUFETHPriceFeed.sol";
import "forge-std/console2.sol";

contract PUFETHPriceFeed is TokenPriceFeedBase, IIPUFETHPriceFeed {
    // pufETH/stETH feed on arbitrum.
    address public pufEthStEthOracleAddress = 0x26399f5229d893Cec6b89a3B52774d700582e1eF;
    Api3Oracle internal _pufEthOracle;

    constructor(
        address _owner,
        address _stEthUsdOracleAddress,
        address _pufEthOracleAddress,
        uint256 _stEthUsdStalenessThreshold,
        uint256 _pufEthUsdStalenessThreshold
    ) TokenPriceFeedBase(_owner, _stEthUsdOracleAddress, _stEthUsdStalenessThreshold) {
        _pufEthOracle.proxy = IApi3ReaderProxy(_pufEthOracleAddress);
        _pufEthOracle.stalenessThreshold = _pufEthUsdStalenessThreshold;
        _pufEthOracle.decimals = 18;

        priceSource = PriceSource.primary;
        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function pufEthOracle() external view returns (Api3Oracle memory, uint256, uint256) {
        return (_pufEthOracle, _pufEthOracle.stalenessThreshold, _pufEthOracle.decimals);
    }

    function _readApi3Oracle(Api3Oracle memory _oracle) internal view returns (int256, bool) {
        (int224 oracleRateInt, uint32 pufEthStEthTimestamp) = _oracle.proxy.read();
        int256 oracleRate = int256(oracleRateInt);

        bool oracleIsDown = block.timestamp - pufEthStEthTimestamp > _oracle.stalenessThreshold;

        if (oracleRate <= 0) {
            oracleIsDown = true;
        }

        return (oracleRate, oracleIsDown);
    }

    function fetchPrice() public returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (int256 pufEthStEthRate, bool pufEthStEthOracleDown) = _readApi3Oracle(_pufEthOracle);
        // ethUSD oracle is set to stEthUsd
        (uint256 stEthUsdRate, bool stEthUsdOracleDown) = _getOracleAnswer(tokenUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good rsETH-USD price calculated
        if (pufEthStEthOracleDown) {
            _shutDownAndSwitchToLastGoodPrice(address(_pufEthOracle.proxy));
        }
        if (stEthUsdOracleDown) {
            _shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator));
        }

        uint256 pufEthUsdPrice = stEthUsdRate * uint256(pufEthStEthRate) / 1e18;

        lastGoodPrice = pufEthUsdPrice;
        return (pufEthUsdPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        return fetchPrice();
    }
}
