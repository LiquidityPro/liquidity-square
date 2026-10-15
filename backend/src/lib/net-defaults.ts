import dns from "node:dns";
import net from "node:net";

// This machine has no IPv6 route. Node's default happy-eyeballs attempt then
// reports ENETUNREACH for the IPv6 address and ETIMEDOUT for the IPv4 one.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);
