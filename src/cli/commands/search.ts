import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SpotifyAPI } from '../../core/SpotifyAPI';

export const searchCommand = new Command('search')
  .alias('s')
  .description('Search for tracks, albums, or artists on Spotify')
  .argument('<query>', 'search query')
  .option('-t, --type <type>', 'search type (track, album, artist, playlist)', 'track')
  .option('-l, --limit <number>', 'maximum results', '10')
  .action(async (query, options) => {
    const spinner = ora('Searching...').start();

    try {
      const spotifyAPI = new SpotifyAPI();
      const results = await spotifyAPI.search(query, options.type, parseInt(options.limit));

      spinner.stop();

      if (options.type === 'track' && results.tracks?.items) {
        console.log(chalk.bold(`\n🎵 Tracks matching "${query}":\n`));
        results.tracks.items.forEach((track: any, i: number) => {
          console.log(`${chalk.gray(`${i + 1}.`)} ${chalk.green(track.name)}`);
          console.log(`   ${chalk.gray('Artist:')} ${track.artists.map((a: any) => a.name).join(', ')}`);
          console.log(`   ${chalk.gray('Album:')} ${track.album.name}`);
          console.log(`   ${chalk.gray('ID:')} ${chalk.cyan(track.id)}`);
          console.log(`   ${chalk.gray('Popularity:')} ${'⭐'.repeat(Math.ceil(track.popularity / 20))}`);
          console.log();
        });
      } else if (options.type === 'album' && results.albums?.items) {
        console.log(chalk.bold(`\n💿 Albums matching "${query}":\n`));
        results.albums.items.forEach((album: any, i: number) => {
          console.log(`${chalk.gray(`${i + 1}.`)} ${chalk.green(album.name)}`);
          console.log(`   ${chalk.gray('Artist:')} ${album.artists.map((a: any) => a.name).join(', ')}`);
          console.log(`   ${chalk.gray('ID:')} ${chalk.cyan(album.id)}`);
          console.log();
        });
      } else if (options.type === 'artist' && results.artists?.items) {
        console.log(chalk.bold(`\n🎤 Artists matching "${query}":\n`));
        results.artists.items.forEach((artist: any, i: number) => {
          console.log(`${chalk.gray(`${i + 1}.`)} ${chalk.green(artist.name)}`);
          console.log(`   ${chalk.gray('Genres:')} ${artist.genres?.join(', ') || 'N/A'}`);
          console.log(`   ${chalk.gray('Followers:')} ${artist.followers?.total?.toLocaleString() || 'N/A'}`);
          console.log(`   ${chalk.gray('ID:')} ${chalk.cyan(artist.id)}`);
          console.log();
        });
      } else {
        console.log(chalk.yellow('No results found.'));
      }
    } catch (error: any) {
      spinner.fail(chalk.red(`Search failed: ${error.message}`));
      process.exit(1);
    }
  });
