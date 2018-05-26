// ==UserScript==
// @name         Derpibooru Comment Enhancements
// @description  Improvements to Derpibooru's comment section
// @version      1.4.5
// @author       Marker
// @license      MIT
// @namespace    https://github.com/marktaiwan/
// @homepageURL  https://github.com/marktaiwan/Derpibooru-Link-Preview
// @supportURL   https://github.com/marktaiwan/Derpibooru-Link-Preview/issues
// @include      https://derpibooru.org/*
// @include      https://trixiebooru.org/*
// @include      https://www.derpibooru.org/*
// @include      https://www.trixiebooru.org/*
// @include      /^https?://(www\.)?(derpibooru|trixiebooru)\.org(/.*|)$/
// @grant        none
// @noframes
// @require      https://openuserjs.org/src/libs/soufianesakhi/node-creation-observer.js
// @require      https://openuserjs.org/src/libs/mark.taiwangmail.com/Derpibooru_Unified_Userscript_UI_Utility.js
// ==/UserScript==

(function() {
    'use strict';

    // ==== User Config ====
    var config = ConfigManager('Derpibooru Comment Enhancements', 'derpi_comment_enhancements');
    config.registerSetting({
        title: 'Linkify images',
        key: 'link_images',
        description: 'Link embedded images to their sources. Images already containing links will be unaffected.',
        type: 'checkbox',
        defaultValue: false
    });
    config.registerSetting({
        title: 'Disable native preview',
        key: 'disable_native_preview',
        description: 'This will disable the site\'s native feature that inserts the linked comment above the current one when clicked, and instead navigates to the targted comment.',
        type: 'checkbox',
        defaultValue: false
    });
    var spoilerSettings = config.addFieldset('Reveal spoiler...');
    spoilerSettings.registerSetting({
        title: '...in comment preview',
        key: 'show_preview_spoiler',
        description: 'Reveal spoilers in the pop-up preview.',
        type: 'checkbox',
        defaultValue: true
    });
    spoilerSettings.registerSetting({
        title: '...in comment highlight',
        key: 'show_highlight_spoiler',
        description: 'Reveal spoilers in the highlighted comment.',
        type: 'checkbox',
        defaultValue: true
    });

    const LINK_IMAGES = config.getEntry('link_images');
    const DISABLE_NATIVE_PREVIEW = config.getEntry('disable_native_preview');
    const SHOW_PREVIEW_SPOILER = config.getEntry('show_preview_spoiler');
    const SHOW_HIGHLIGHT_SPOILER = config.getEntry('show_highlight_spoiler');
    // ==== /User Config ====

    const HOVER_ATTRIBUTE = 'comment-preview-active';
    var fetchCache = {};
    var backlinksCache = {};

    function timeAgo(ele) {
        // Firefox 57/Greasemonkey 4 compatibility
        var booru = window.booru || window.wrappedJSObject.booru;
        booru.timeAgo(ele);
    }

    function displayHover(comment, sourceLink) {
        const PADDING = 5; // in pixels

        comment = comment.cloneNode(true);
        comment.id = 'hover_preview';
        comment.style.position = 'absolute';
        comment.style.maxWidth = '980px';
        comment.style.minWidth = '490px';
        comment.style.boxShadow = '0px 0px 12px 0px rgba(0, 0, 0, 0.4)';

        if (SHOW_PREVIEW_SPOILER) {
            revealSpoiler(comment);
        }

        // relative time
        timeAgo(comment.querySelectorAll('time'));

        var container = document.getElementById('image_comments') || document.getElementById('content');
        if (container) container.appendChild(comment);

        // calculate link position
        var linkRect = sourceLink.getBoundingClientRect();
        var linkTop = linkRect.top + viewportPosition().top;
        var linkLeft = linkRect.left + viewportPosition().left;

        var commentRect = comment.getBoundingClientRect();
        var commentTop;
        var commentLeft;


        if (sourceLink.parentElement.classList.contains('comment_backlinks')) {
            // When there is room, place the preview below the link,
            // otherwise place it above the link
            if (document.documentElement.clientHeight - linkRect.bottom > commentRect.height + PADDING) {

                commentTop = linkTop + linkRect.height + PADDING;
                commentLeft = (commentRect.width + linkLeft < document.documentElement.clientWidth) ? (
                    linkLeft
                ) : (
                    document.documentElement.clientWidth - (commentRect.width + PADDING)
                );

            } else {

                commentTop = linkTop - commentRect.height - PADDING;
                commentLeft = (commentRect.width + linkLeft < document.documentElement.clientWidth) ? (
                    linkLeft
                ) : (
                    document.documentElement.clientWidth - (commentRect.width + PADDING)
                );

            }
        } else {
            // When there is room, place the preview above the link
            // otherwise place it to the right and aligns it to the top of viewport
            if (linkRect.top > commentRect.height + PADDING) {

                commentTop = linkTop - commentRect.height - PADDING;
                commentLeft = (commentRect.width + linkLeft < document.documentElement.clientWidth) ? (
                    linkLeft
                ) : (
                    document.documentElement.clientWidth - (commentRect.width + PADDING)
                );

            } else {

                commentTop = viewportPosition().top + PADDING;
                commentLeft = linkLeft + linkRect.width + PADDING;

            }
        }

        comment.style.top = commentTop + 'px';
        comment.style.left = commentLeft + 'px';
    }

    function linkEnter(sourceLink, targetCommentID, isForumPost) {
        sourceLink.setAttribute(HOVER_ATTRIBUTE, 1);
        const selector = isForumPost ? 'post_' : 'comment_';
        var targetComment = document.getElementById(selector + targetCommentID);

        if (targetComment !== null) {

            highlightReplyLink(targetComment, sourceLink, isForumPost);

            if (!elementInViewport(targetComment)) {
                displayHover(targetComment, sourceLink);
            }
            if (SHOW_HIGHLIGHT_SPOILER) {
                revealSpoiler(targetComment);
            }

            // Highlight linked post
            targetComment.children[0].style.backgroundColor = 'rgba(230,230,30,0.3)';
            if (targetComment.querySelector('.comment_backlinks') !== null) targetComment.children[1].style.backgroundColor = 'rgba(230,230,30,0.3)';

        }
        else if (!isForumPost) {

            // External post, display from cached response if possible
            if (fetchCache[targetCommentID] !== undefined) {
                displayHover(fetchCache[targetCommentID], sourceLink);
            } else {
                fetch(window.location.origin + '/comment/' + targetCommentID + '.html')
                    .then((response) => response.text())
                    .then((text) => {
                        if (fetchCache[targetCommentID] === undefined && sourceLink.getAttribute(HOVER_ATTRIBUTE) !== '0') {
                            var d = document.createElement('div');
                            d.innerHTML = text;
                            fetchCache[targetCommentID] = d.firstChild;
                            displayHover(d.firstChild, sourceLink);
                        }
                    });
            }

        }
    }

    function linkLeave(sourceLink, targetCommentID, isForumPost) {
        sourceLink.setAttribute(HOVER_ATTRIBUTE, 0);
        const selector = isForumPost ? 'post_' : 'comment_';
        var targetComment = document.getElementById(selector + targetCommentID);
        var preview = document.getElementById('hover_preview');

        if (targetComment !== null) {
            // remove comment highlight
            targetComment.children[0].style.backgroundColor = '';
            if (targetComment.querySelector('.comment_backlinks') !== null) targetComment.children[1].style.backgroundColor = '';

            // remove link highlight
            var ele = sourceLink;
            while (ele.parentElement !== null && !ele.matches('article')) ele = ele.parentElement;
            var sourceCommentID = ele.id.slice(selector.length);
            var list = targetComment.querySelectorAll('a[href$="#' + selector + sourceCommentID + '"]');
            for (var i = 0; i < list.length; i++) {
                list[i].style.textDecoration = '';
            }

            // unreveal spoilers
            // we use the 'reveal-preview-spoiler' attribute to avoid reverting spoilers manually revealed by users
            var spoilers = targetComment.querySelectorAll('.spoiler-revealed[reveal-preview-spoiler]');
            var imgspoilers = targetComment.querySelectorAll('.imgspoiler-revealed[reveal-preview-spoiler]');
            for (var spoiler of spoilers) {
                spoiler.classList.remove('spoiler-revealed');
                spoiler.classList.add('spoiler');
                spoiler.removeAttribute('reveal-preview-spoiler');
            }
            for (var imgspoiler of imgspoilers) {
                imgspoiler.classList.remove('imgspoiler-revealed');
                imgspoiler.classList.add('imgspoiler');
                imgspoiler.removeAttribute('reveal-preview-spoiler');
            }
        }

        if (preview !== null) preview.parentElement.removeChild(preview);
    }

    // Chrome/Firefox compatibility hack for getting viewport position
    function viewportPosition() {
        return {
            top: (document.documentElement.scrollTop || document.body.scrollTop),
            left: (document.documentElement.scrollLeft || document.body.scrollLeft)
        };
    }

    function elementInViewport(el) {

        // Calculate the ratio of post height and viewport height, and clamp it to a min/max value,
        // and use it to decide whether to use highlight or preview on a comment that's partially in view.
        // The script will prefer the use of highlights on long comments,
        // when using the preview might take up most of the viewport

        var rect = el.getBoundingClientRect();
        var ratio = Math.max(0.25, Math.min(0.95, rect.height / document.documentElement.clientHeight));
        var margin = Math.round(rect.height * ratio);   // pixels outside of viewport before element is considered out of view

        return (
            rect.top + margin >= 0 &&
            rect.bottom - margin <= document.documentElement.clientHeight
        );
    }

    function createBacklinksContainer(commentBody) {
        var ele = commentBody.querySelector('div.comment_backlinks');

        if (ele === null) {

            ele = document.createElement('div');
            ele.className = 'block__content comment_backlinks';
            ele.style.fontSize = '12px';
            // Firefox 57 Workaround: getComputedStyle(commentBody.firstChild)['border-top'] returns an empty string
            ele.style.borderTopStyle = window.getComputedStyle(commentBody.firstChild)['border-top-style'];
            ele.style.borderTopWidth = window.getComputedStyle(commentBody.firstChild)['border-top-width'];
            ele.style.borderTopColor = window.getComputedStyle(commentBody.firstChild)['border-top-color'];

            commentBody.insertBefore(ele, commentBody.querySelector('.communication__options'));
        }
        return ele;
    }

    function insertBacklink(backlink, commentID, isForumPost) {

        // add to cache
        if (backlinksCache[commentID] === undefined) backlinksCache[commentID] = [];
        if (backlinksCache[commentID].findIndex((ele) => (ele.hash == backlink.hash)) == -1) {
            backlinksCache[commentID].push(backlink);
        }
        const selector = isForumPost ? 'post_' : 'comment_';
        var commentBody = document.getElementById(selector + commentID);
        if (commentBody !== null) {
            var linksContainer = createBacklinksContainer(commentBody);

            // insertion sort the links so they are ordered by id
            if (linksContainer.children.length > 0) {
                var iLinkID = parseInt(backlink.hash.slice(9), 10);
                var iTempID;
                var i;

                for (i = 0; i < linksContainer.children.length; i++) {
                    iTempID = parseInt(linksContainer.children[i].hash.slice(9), 10);

                    if (iLinkID == iTempID) {  // prevent links to the same comment from being added multiple times
                        return;
                    }
                    if (iLinkID < iTempID) {
                        linksContainer.insertBefore(backlink, linksContainer.children[i]);
                        return;
                    }
                }
            }
            linksContainer.appendChild(backlink);
            return;
        }

    }

    function revealSpoiler(comment) {
        var spoilers = comment.querySelectorAll('.spoiler');
        var imgspoilers = comment.querySelectorAll('.imgspoiler');

        for (var spoiler of spoilers) {
            spoiler.classList.remove('spoiler');
            spoiler.classList.add('spoiler-revealed');
            spoiler.setAttribute('reveal-preview-spoiler', '1');
        }
        for (var imgspoiler of imgspoilers) {
            imgspoiler.classList.remove('imgspoiler');
            imgspoiler.classList.add('imgspoiler-revealed');
            imgspoiler.setAttribute('reveal-preview-spoiler', '1');
        }
    }

    function highlightReplyLink(comment, sourceLink, isForumPost) {
        const selector = isForumPost ? 'post_' : 'comment_';
        var ele = sourceLink;
        while (ele.parentElement !== null && !ele.matches('article')) ele = ele.parentElement;
        var sourceCommentID = ele.id.slice(selector.length);
        var list = comment.querySelectorAll('a[href$="#' + selector + sourceCommentID + '"]');

        for (var i = 0; i < list.length; i++) {
            list[i].style.textDecoration = 'underline dashed';
        }
    }

    function getQueryVariable(key, HTMLAnchorElement) {
        var i;
        var array = HTMLAnchorElement.search.substring(1).split('&');

        for (i = 0; i < array.length; i++) {
            if (key == array[i].split('=')[0]) {
                return array[i].split('=')[1];
            }
        }
    }

    function insertButton(displayText) {

        var commentsBlock = document.querySelector('.js-editable-comments');

        var ele = document.createElement('div');
        ele.className = 'block__header';
        ele.id = 'comment_loading_button';
        ele.style.textAlign = 'center';

        ele.appendChild(document.createElement('a'));
        ele.firstChild.style.padding = '0px';
        ele.firstChild.style.width = '100%';
        ele.firstChild.innerText = displayText;

        commentsBlock.insertBefore(ele, commentsBlock.lastElementChild);

        return ele;
    }

    function loadComments(e, imageId, nextPage, lastPage) {
        e.target.parentElement.remove();

        var btn = insertButton('Loading...');
        var fetchURL = window.location.origin + '/images/' + imageId + '/comments?id=' + imageId + '&page=' + nextPage;

        fetch(fetchURL, {credentials: 'same-origin'})  // cookie needed for correct pagination
            .then((response) => response.text())
            .then((text) => {
                // response text => documentFragment
                var ele = document.createElement('div');
                var range = document.createRange();

                ele.innerHTML = text;
                range.selectNodeContents(ele.firstChild);

                var fragment = range.extractContents();
                var commentsBlock = document.getElementById('image_comments');

                // update pagination blocks
                commentsBlock.replaceChild(fragment.firstChild, commentsBlock.firstElementChild);
                commentsBlock.replaceChild(fragment.lastChild, commentsBlock.lastElementChild);

                // page marker
                ele.innerHTML = '';
                ele.className = 'block block__header';
                ele.style.textAlign = 'center';
                ele.innerText = 'Page ' + nextPage;

                // relative time
                timeAgo(fragment.querySelectorAll('time'));

                fragment.insertBefore(ele, fragment.firstElementChild);
                commentsBlock.insertBefore(fragment, commentsBlock.lastElementChild);

                // configure button to load the next batch of comments
                btn.remove();
                if (nextPage < lastPage) {
                    btn = insertButton('Load more comments');
                    btn.addEventListener('click', (e) => {
                        loadComments(e, imageId, nextPage + 1, lastPage);
                    });
                }

            });
    }

    NodeCreationObserver.onCreation('article[id^="comment_"], article[id^="post_"]', function (sourceCommentBody) {
        const isForumPost = sourceCommentBody.matches('[id^="post_"]');
        const selector = isForumPost ? 'post_' : 'comment_';

        var links = sourceCommentBody.querySelectorAll(`.communication__body__text a[href*="#${selector}"]`);
        var sourceCommentID = sourceCommentBody.id.slice(selector.length);
        var ele = sourceCommentBody.querySelector('.communication__body__sender-name');
        var sourceAuthor = (ele.firstElementChild !== null && ele.firstElementChild.matches('a')) ? ele.firstElementChild.innerText : ele.innerHTML;

        links.forEach((link) => {
            var targetCommentID = link.hash.slice(selector.length + 1);    // Example: link.hash == "#comment_5430424" or link.hash == "#post_5430424"
            var backlink;

            // add backlink if the comment is not part of a quote
            // and not fetched
            if (!link.matches('blockquote a') && !sourceCommentBody.matches('.fetched-comment')) {
                backlink = document.createElement('a');

                backlink.style.marginRight = '5px';
                backlink.href = '#' + selector + sourceCommentID;
                backlink.textContent = '►';
                backlink.innerHTML += sourceAuthor;

                backlink.addEventListener('mouseenter', () => {
                    linkEnter(backlink, sourceCommentID, isForumPost);
                });
                backlink.addEventListener('mouseleave', () => {
                    linkLeave(backlink, sourceCommentID, isForumPost);
                });
                backlink.addEventListener('click', () => {
                    // force pageload instead of trying to navigate to a nonexistent anchor on the current page
                    if (document.getElementById(selector + sourceCommentID) === null) window.location.reload();
                });

                insertBacklink(backlink, targetCommentID, isForumPost);
            }

            if (DISABLE_NATIVE_PREVIEW) {
                link.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    // quoted links doesn't contain query strings, this prevents page reload on links like "derpibooru.org/1234?q=tag"
                    var a = document.createElement('a');
                    if (isForumPost && (document.getElementById('post_' + targetCommentID) === null)) {
                        a.href = e.currentTarget.href;
                    } else {
                        a.href = window.location.pathname + window.location.search + e.currentTarget.hash;
                    }
                    a.click();
                });
            }

            // ignore quoted comments
            // this is terrible
            for (let i = 0, ele = link; i < 3; i++) {
                ele = ele.nextSibling;
                if (ele == null) break;
                if (i == 2 && ele.matches('blockquote[title]')) return;
            }

            link.addEventListener('mouseenter', () => {
                linkEnter(link, targetCommentID, isForumPost);
            });
            link.addEventListener('mouseleave', () => {
                linkLeave(link, targetCommentID, isForumPost);
            });

        });

        // If other pages had replied to this comment
        if (backlinksCache[sourceCommentID] !== undefined) {
            backlinksCache[sourceCommentID].forEach((backlink) => {
                insertBacklink(backlink, sourceCommentID);
            });
        }

    });

    // Load and append more comments
    NodeCreationObserver.onCreation('#image_comments nav>a.js-next', function (btnNextPage) {
        if (document.getElementById('comment_loading_button') !== null) return;

        var btnLastPage = btnNextPage.nextElementSibling;
        var imageId = getQueryVariable('id', btnNextPage);
        var nextPage = parseInt(getQueryVariable('page', btnNextPage), 10);
        var lastPage = parseInt(getQueryVariable('page', btnLastPage), 10);
        var btn = insertButton('Load more comments');

        btn.addEventListener('click', (e) => {
            loadComments(e, imageId, nextPage, lastPage);
        });
    });

    // Add clickable links to hotlinked images
    if (LINK_IMAGES) {
        NodeCreationObserver.onCreation('.communication__body__text .imgspoiler>img, .image-description .imgspoiler>img', img => {
            if (img.closest('a') !== null) return; // Image is already part of link so we do nothing.

            const imgParent = img.parentElement;
            const anchor = document.createElement('a');
            const resultsArray = img.src.match(/https?:\/\/(?:www\.)?(?:(?:derpibooru\.org|trixiebooru\.org)\/(?:images\/)?(\d{1,})(?:\?|\?.{1,}|\/|\.html)?|derpicdn\.net\/img\/(?:view\/)?\d{1,}\/\d{1,}\/\d{1,}\/(\d+))/i);

            if (resultsArray !== null) {
                const imageID = resultsArray[1] || resultsArray[2]; // Image is on Derpibooru
                anchor.href = `/${imageID}`;
            } else {
                anchor.href = decodeURIComponent(img.src.substr(img.src.indexOf('?url=') + 5));
            }
            anchor.appendChild(img);
            imgParent.appendChild(anchor);
        });
    }
})();
