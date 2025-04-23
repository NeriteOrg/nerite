// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TokenPriceFeedBase.sol";
import "../Interfaces/IPUFETHPriceFeed.sol";

contract pufETHPriceFeed is TokenPriceFeedBase, IIPUFETHPriceFeed {
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

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function pufEthOracle() external view returns (Api3Oracle memory, uint256, uint256) {
        return (_pufEthOracle, _pufEthOracle.stalenessThreshold, _pufEthOracle.decimals);
    }

    function _readApi3Oracle(Api3Oracle memory _oracle) internal view returns (uint256, bool) {
        (int224 oracleRateInt, uint32 pufEthStEthTimestamp) = _oracle.proxy.read();
        uint256 oracleRate;
        bool oracleIsDown = pufEthStEthTimestamp - block.timestamp > _oracle.stalenessThreshold;
        if (oracleRateInt > 0) {
            oracleRate = uint256(uint224(oracleRateInt));
        } else {
            // if pufEth is worth more than stEth, then what?
        }

        require(oracleRate != 0, "Api3 oracle rate is 0");

        return (oracleRate, oracleIsDown);
    }

    function fetchPrice() public returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 pufEthStEthRate, bool pufEthStEthOracleDown) = _readApi3Oracle(_pufEthOracle);
        // ethUSD oracle is set to stEthUsd
        (uint256 stEthUsdRate, bool stEthUsdOracleDown) = _getOracleAnswer(tokenUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good rsETH-USD price calculated
        if (pufEthStEthOracleDown) revert("pufEthStEthOracleDown");
        if (stEthUsdOracleDown) revert("stEthUsdOracleDown");

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * underlying_per_LST
        uint256 pufEthUsdPrice = stEthUsdRate * pufEthStEthRate / 1e18;

        lastGoodPrice = pufEthUsdPrice;
        return (pufEthUsdPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        return fetchPrice();
    }
}
