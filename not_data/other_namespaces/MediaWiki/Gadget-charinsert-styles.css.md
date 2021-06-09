title = MediaWiki:Gadget-charinsert-styles.css
redirects =
>>>>

/*  _____________________________________________________________________________
 * |                                                                             |
 * |                    === WARNING: GLOBAL GADGET FILE ===                      |
 * |                  Changes to this page affect many users.                    |
 * | Please discuss changes on the talk page or on [[WT:Gadget]] before editing. |
 * |_____________________________________________________________________________|
 *
 */

/* Overwrites selector from MediaWiki:Common.css */
div#editpage-specialchars {
	display: block;
	border: 1px solid #c0c0c0;
	padding: .5em 1em;
}

#editpage-specialchars a {
	background-color: #f9f9f9;
	border: 1px solid #ddd;
	padding: 1px 4px;
}

textarea#wpTextbox1 + #editpage-specialchars,
.wikiEditor-ui-clear + #editpage-specialchars {
	border-top: 0;
}