import {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {parseISO} from 'date-fns'

function CacheBuster({
                       children = null,
                       currentVersion,
                       isEnabled = false,
                       isVerboseMode = false,
                       loadingComponent = null,
                       comparisonStrategy = "by_semantic_version",
                       checkInSecs = 600
                     }) {
  const [counter, setCounter] = useState(0);
  const [cacheStatus, setCacheStatus] = useState({
    loading: true,
    isLatestVersion: false
  });

  const log = (message, isError) => {
    isVerboseMode && (isError ? console.error(message) : console.log(message));
  };

  useEffect(() => {
    isEnabled ? checkCacheStatus() : log('React Cache Buster is disabled.');
  }, []);

  useEffect(() => {
    let interval = null;
    if (isEnabled) {
      interval = setInterval(() => {
        log('React Cache Buster triggering timer')
        setCounter(counter => counter + 1);
      }, checkInSecs * 1000);
      checkCacheStatus()
    } else if (!isEnabled && interval) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isEnabled, counter]);


  const checkCacheStatus = async () => {
    try {
      const res = await fetch('/meta.json', {
        method: 'GET',
        cache: 'no-cache'
      });
      const {version: metaVersion} = await res.json();

      const shouldForceRefresh = isThereNewVersion(comparisonStrategy, metaVersion, currentVersion);
      if (shouldForceRefresh) {
        log(`There is a new version (v${metaVersion}). Should force refresh.`);
        setCacheStatus({
          loading: false,
          isLatestVersion: false
        });
      } else {
        log('There is no new version. No cache refresh needed.');
        setCacheStatus({
          loading: false,
          isLatestVersion: true
        });
      }
    } catch (error) {
      log('An error occurred while checking cache status.', true);
      log(error, true);

      //Since there is an error, if isVerboseMode is false, the component is configured as if it has the latest version.
      !isVerboseMode &&
      setCacheStatus({
        loading: false,
        isLatestVersion: true
      });
    }
  };

  const isThereNewVersion = (comparisonStrategy, metaVersion, currentVersion) => {
    if (!currentVersion) {
      return false;
    }

    if (comparisonStrategy === "by_equality") {
      return notEqual(metaVersion, currentVersion)
    } else if (comparisonStrategy === "by_iso_date") {
      return compareDate(metaVersion, currentVersion)
    } else
      return semanticCompare(metaVersion, currentVersion)
  }
  const notEqual = (metaVersion, currentVersion) => {
    return `${metaVersion}` !== `${currentVersion}`
  };
  const compareDate = (metaVersion, currentVersion) => {
    const currentDate = parseISO(currentVersion)
    if (!currentDate) {
      return false
    }
    const metaDate = parseISO(metaVersion)
    if (!metaDate) {
      return false
    }

    return metaDate > currentDate
  };


  const semanticCompare = (metaVersion, currentVersion) => {
    const metaVersions = metaVersion.split(/\./g);
    const currentVersions = currentVersion.split(/\./g);

    while (metaVersions.length || currentVersions.length) {
      const a = Number(metaVersions.shift());

      const b = Number(currentVersions.shift());
      if (a === b) {
        continue;
      }
      return a > b || isNaN(b);
    }
    return false;
  };

  const refreshCacheAndReload = async () => {
    try {
      if (caches) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          caches.delete(cacheName);
        }
        log('The cache has been deleted.');
        window.location.reload(true);
      }
    } catch (error) {
      log('An error occurred while deleting the cache.', true);
      log(error, true);
    }
  };

  if (!isEnabled) {
    return children;
  } else {
    if (cacheStatus.loading) {
      return loadingComponent;
    }

    if (!cacheStatus.loading && !cacheStatus.isLatestVersion) {
      refreshCacheAndReload();
      return null;
    }
    return children;
  }
}

CacheBuster.propTypes = {
  children: PropTypes.element.isRequired,
  currentVersion: PropTypes.string.isRequired,
  isEnabled: PropTypes.bool.isRequired,
  isVerboseMode: PropTypes.bool,
  loadingComponent: PropTypes.element
};

export {CacheBuster};
