# &lt;article title="mc.dhugs.com"&gt;

## Personalized Minecraft Hosting

After several years of experimenting with hosting Minecraft servers and diving into the fundamentals of web hosting, I’ve finally created an experience I’m proud of. The best part? The only recurring cost is the domain name, which is about $1 a month.

With dhugs.com, I’ve combined a reliable web hosting setup on Oracle Cloud servers with the innovative Pyrodactyl panel for Minecraft server management. Let’s dive into the details.

---

## Hosting Infrastructure

I’m hosting dhugs.com on a pair of Ubuntu 24.04 LTS servers with the following specs:

- 24 GB RAM
- 4 CPU cores
- 200 GB storage
- ARM-based architecture

### Server 1: Website Hosting

The first machine runs an Apache2 webserver with:

- **WordPress**: Fully managed with SSL/TLS encryption.
- **Optimized Media**: Featured images use the AVIF format for fast loading.
- **Google Photos API Integration**: High-quality photos are served directly from Google Photos albums, reducing bandwidth costs and taking advantage of Google’s lightning-fast servers.

### Server 2: Game Server Hosting

The second machine powers:

- **Pyrodactyl Panel**: A modern game server management panel based on Pterodactyl, optimized for performance and usability. It runs on Caddy, a fast and secure web server.
- **Minecraft Server**: Managed as a Docker container with preloaded Java 21. This setup allows easy backups, server resets, and custom server environments.
- **Additional Features:**
  - Reverse-proxied BlueMap mod for real-time server maps with player locations.
  - Full TLS/SSL encryption using Caddy for all subdomains.

---

## Cloudflare DNS and Networking Setup

I’ve configured Cloudflare DNS to streamline my hosting setup, as shown in the attached image. Here’s how it all works:

### Website and Email

- **A Records & CNAMEs**: dhugs.com and www.dhugs.com point to the WordPress site.
- **Vanity Email**: MX and TXT records allow a custom email without the hassle of running my own mail server.

### Minecraft and Panel

- **panel.dhugs.com**: Hosts the Pyrodactyl management panel, allowing web-based server management.
- **mc.dhugs.com**: Connects players directly to the Minecraft server. This subdomain is unproxied since Cloudflare’s free proxy only supports ports 80 and 443, while Minecraft’s default port (25565) requires direct access.
- **map.dhugs.com**: Displays a live, interactive map of the Minecraft world using BlueMap.

### Why These Choices?

- **Unproxied SSH Access**: Some subdomains remain unproxied to allow straightforward SSH connections.
- **TLS/SSL for Secure Connections**: Cloudflare’s HTTPS encryption ensures all communication between the panel and its nodes is secure.
- **Cost Efficiency**: Using Cloudflare’s free plan avoids extra costs for forwarding Minecraft traffic while still ensuring protection of web servers.

---

## The Minecraft Experience

### Seamless Modpack and Compatibility

- Structure and Terrain Enhancements: Elevates the exploration and gameplay experience.
- Server-Side Optimizations: Ensures blazing-fast performance with minimal lag.
- Voice Chat Support: The server includes a voice chat mod for enhanced communication and teamwork.

### Real-Time Map Viewer

- Real-time updates
- Player locations
- Full SSL/TLS encryption for a seamless browsing experience

---

## A Professional Setup for Everyone

The Pyrodactyl panel makes it easy to manage servers with a polished interface and advanced features. I’ve even set up a similar system for a friend, allowing them to manage their server with separate credentials on the same panel. It’s a professional, scalable solution that showcases the flexibility of this setup.

I’m also open to a bring-your-own-server setup. This means you can:

- Utilize dhugs.com subdomains for Minecraft server joining.
- Manage your server effortlessly through panel.dhugs.com without worrying about the technical setup—I’ll handle everything for you.

Join the dhugs.com Minecraft server today and experience a blend of cutting-edge hosting, exciting gameplay, and thoughtful optimization. Whether you’re here to explore, build, or just hang out, this server has something for everyone!

&lt;/article&gt;
