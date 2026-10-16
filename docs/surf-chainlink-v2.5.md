# Surf Chainlink VRF v2.5 recovery

## Frozen ledger and round history

The current production round is `RENAISS_SURF_V1_MAIN_ROUND_2`. Its Binance VRF
request transaction is `0xd2d802c504f29db543d6da1e3460eeab2319cd0985d6cea1e9e6cdac23f6defd`.
At the read-only check on 2026-10-16, it remained pending more than 5,000
finalized BSC blocks later. The locked snapshot has 2,434 participants and
6,506 tickets. The old contract and transactions must remain verifiable.

`RENAISS_SURF_V1_CHAINLINK_ROUND_3` is a new draw ID. The local-only replacement
control copies the round-two canonical entries, prizes, rules and contact
snapshot, changing only the draw ID and its commitment hash. It records the
superseded Binance request before selecting the Chainlink round in the
persistent database. The replacement itself signs no transaction and requests
no randomness.

## Source contract

`contracts/chainlink-surf/ChainlinkSurfDraw.sol` uses the official BNB Chain
mainnet Chainlink VRF v2.5 wrapper with native BNB direct funding. Its one-time
request pays the wrapper's exact price from the operator transaction. There is
no subscription and no prefunded consumer balance. The wrapper is the only
caller allowed to deliver a word. The callback stores just the word. The
reviewed `TicketRankSelection` selector computes all 27 unique winning tickets
when the first batch is revealed; subsequent reveals use the same stored
selection. A person can win again only through a different ticket, matching
the frozen ledger rules. The contract cannot request randomness twice or
reset after a request.

The new source requires a new deployment because the Binance VRF coordinator
is immutable in the old consumer. Runtime code hash, chain ID, draw ID,
wrapper address, and operator are checked before the app enables action. The
old results contract is still used for old rounds; the Chainlink contract
contains its own result publication. No off-chain randomness is substituted.

The deployment script estimates before broadcast by default; `--deploy` is
explicit. It enforces a 0.001 BNB deployment gas budget. The request path
enforces a 0.002 BNB total budget including the direct-funding price. The
quote is recalculated using the same gas price as the signed transaction.
These are maximum guards, not expected costs.

## Release sequence

1. Compile the new contract and review its bytecode and ABI.
2. Push the reviewed source through the normal GitHub deployment branch after
   explicit approval. The active round remains on Binance at this point.
3. Deploy the new source from the authorized BSC operator signer, record its
   address, deployment transaction and runtime code hash. Do not request VRF.
4. Set `SURF_CHAINLINK_SOURCE_ADDRESS` and `SURF_CHAINLINK_RUNTIME_HASH` on the
   production service; verify the live code and source metadata.
5. Recheck that round two remains pending and that the old request is more
   than 256 finalized blocks old. Trigger the local-only replacement once.
6. Confirm the new snapshot still has 2,434 participants, 6,506 tickets, 27
   prizes, identical entries and contacts, and no Chainlink request. Leave
   finalization and the one paid VRF request for the operator's buttons.

Reference: [Chainlink supported networks](https://docs.chain.link/vrf/v2-5/supported-networks/),
[direct funding](https://docs.chain.link/vrf/v2-5/direct-funding/get-a-random-number/),
[security considerations](https://docs.chain.link/vrf/v2-5/security).
