// SPDX-License-Identifier: MIT
import "../Dependencies/AggregatorV3Interface.sol";
import "./IPriceFeed.sol";

pragma solidity ^0.8.0;

interface IWSTETHPriceFeed {
    function stEthUsdOracle() external view returns (AggregatorV3Interface, uint256, uint8);
}
