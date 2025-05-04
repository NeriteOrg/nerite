// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IApi3ReaderProxy.sol";

interface IIPUFETHPriceFeed {
    struct Api3Oracle {
        IApi3ReaderProxy proxy;
        uint256 stalenessThreshold;
        uint256 decimals;
    }

    function pufEthOracle() external view returns (Api3Oracle memory, uint256, uint256);
}
