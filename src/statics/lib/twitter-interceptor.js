(function() {
  console.log('[PTK-Interceptor] Fetch interceptor installed');
  var originalFetch = window.fetch;
  window.fetch = async function(...args) {
    var response = await originalFetch.apply(this, args);
    try {
      var url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url) || '';
      if (url.includes('/graphql/')) {
        console.log('[PTK-Interceptor] GraphQL request detected:', url.substring(0, 120));
        if (url.includes('TweetDetail') || url.includes('TweetResultByRestId')) {
          console.log('[PTK-Interceptor] Tweet API matched, cloning response...');
          var clone = response.clone();
          clone.json().then(function(json) {
            console.log('[PTK-Interceptor] Response keys:', Object.keys(json));
            // TweetDetail format
            if (json && json.data && json.data.threaded_conversation_with_injections_v2) {
              var instructions = json.data.threaded_conversation_with_injections_v2.instructions;
              for (var i = 0; i < instructions.length; i++) {
                if (instructions[i].entries) {
                  for (var j = 0; j < instructions[i].entries.length; j++) {
                    var entry = instructions[i].entries[j];
                    var result = entry.content && entry.content.itemContent && entry.content.itemContent.tweet_results && entry.content.itemContent.tweet_results.result;
                    if (result) {
                      var tweet = result.__typename === 'TweetWithVisibilityResults' ? result.tweet : result;
                      var legacy = tweet && (tweet.legacy || (tweet.tweet && tweet.tweet.legacy));
                      if (legacy && legacy.id_str) {
                        console.log('[PTK-Interceptor] Captured tweet:', legacy.id_str);
                        window.dispatchEvent(new CustomEvent('__ptk_tweet_data', {
                          detail: JSON.stringify({ tweetId: legacy.id_str, tweetResult: tweet })
                        }));
                      }
                    }
                  }
                }
              }
            }
            // TweetResultByRestId format
            if (json && json.data && json.data.tweetResult && json.data.tweetResult.result) {
              var result2 = json.data.tweetResult.result;
              var tweet2 = result2.__typename === 'TweetWithVisibilityResults' ? result2.tweet : result2;
              var legacy2 = tweet2 && (tweet2.legacy || (tweet2.tweet && tweet2.tweet.legacy));
              if (legacy2 && legacy2.id_str) {
                console.log('[PTK-Interceptor] Captured tweet (ByRestId):', legacy2.id_str);
                window.dispatchEvent(new CustomEvent('__ptk_tweet_data', {
                  detail: JSON.stringify({ tweetId: legacy2.id_str, tweetResult: tweet2 })
                }));
              }
            }
          }).catch(function(err) {
            console.error('[PTK-Interceptor] Error parsing response:', err);
          });
        }
      }
    } catch(e) {
      console.error('[PTK-Interceptor] Error:', e);
    }
    return response;
  };
})();
